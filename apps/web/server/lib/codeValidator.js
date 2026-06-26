// Static validation for LLM-emitted code blocks. We deliberately do not
// run the code — submission use cases rely on the user's local R/Python
// environment, which has the GBIF credentials we don't have. Instead we
// parse the code with the actual language tool, which catches the
// dominant failure mode (LLM emits broken syntax) without ever
// executing a single line.
//
// R validation uses `Rscript -e "parse(text = ...)"`. If R isn't on the
// server PATH (the default on Vercel Hobby), we skip silently — better
// to ship unvalidated code than to fail the workflow because a build
// image doesn't have R installed. When R is present, a parse failure
// surfaces as a hard error so the caller can fall back to the
// deterministic workflow.
//
// Python validation uses `python3 -c "compile(code, '<generated>', 'exec')"`.
// Same skip-if-missing policy.
//
// Both checks are bounded: 5s timeout via a child process kill, so a
// runaway `Rscript` can't pin a serverless function.

import { spawn } from 'node:child_process'

const VALIDATION_TIMEOUT_MS = 5000

export function validateRCode(source) {
  return runValidator({
    binary: 'Rscript',
    binaryArgs: ['--vanilla', '--no-save', '-e', `parse(text = ${JSON.stringify(String(source || ''))})`],
    notFoundMessage:
      'Rscript is not available on the server; R code shipped without static parse validation. Install R on the deploy image for full validation.',
  })
}

export function validatePythonCode(source) {
  return runValidator({
    binary: 'python3',
    binaryArgs: [
      '-c',
      `import sys; compile(sys.stdin.read(), '<generated>', 'exec'); print('OK')`,
    ],
    // Feed source via stdin so embedded quotes / heredocs from the LLM
    // don't collide with the shell.
    stdin: String(source || ''),
    notFoundMessage:
      'python3 is not available on the server; Python code shipped without static parse validation. Install python3 on the deploy image for full validation.',
  })
}

function runValidator({ binary, binaryArgs, stdin, notFoundMessage }) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(binary, binaryArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (caught) {
      resolve({ status: 'skipped', reason: caught instanceof Error ? caught.message : String(caught) })
      return
    }

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      resolve({ status: 'error', stderr: `Validation timed out after ${VALIDATION_TIMEOUT_MS}ms.` })
    }, VALIDATION_TIMEOUT_MS)

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (err && (err.code === 'ENOENT' || /ENOENT/.test(String(err.message)))) {
        resolve({ status: 'skipped', reason: notFoundMessage })
        return
      }
      resolve({ status: 'error', stderr: err && err.message ? err.message : String(err) })
    })

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (signal === 'SIGKILL') {
        resolve({ status: 'error', stderr: `Validation killed by timeout.` })
        return
      }
      if (code === 0) {
        resolve({ status: 'valid', stdout, stderr })
        return
      }
      resolve({ status: 'error', stderr: stderr.trim() || stdout.trim() || `Exit code ${code}` })
    })

    if (typeof stdin === 'string' && child.stdin) {
      child.stdin.end(stdin)
    }
  })
}