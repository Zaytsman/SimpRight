# Security Policy

## Reporting a vulnerability

Please don't open a public issue for security problems. Report them privately through
[GitHub's private vulnerability reporting](https://github.com/Zaytsman/SimpRight/security/advisories/new)
(the **Security** tab → **Report a vulnerability**).

Include what you found, where (file or workflow), and how to reproduce it. You'll get a reply as soon as possible.

## Scope

This repository is a test automation framework. Relevant reports include:

- leaked credentials or tokens in the code, history or published reports
- GitHub Actions workflows that could expose secrets or run untrusted code
- vulnerable dependencies that affect the framework

The application under test, [Practice Software Testing](https://practicesoftwaretesting.com), is a public demo
maintained by someone else, so report its issues to its maintainers instead.
