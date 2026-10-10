# Change password

<!-- Written by the requirements-analyst agent (/analyze-requirements). Source: docs/ui/user-stories/Change_Password.md -->

| | |
|---|---|
| **Source** | [Change_Password.md](../ui/user-stories/Change_Password.md) |
| **Type** | User story |
| **Criteria in scope** | AC1-AC6 (all) |
| **Analysed** | 2026-10-10 |

## Summary

A logged-in customer wants to change their password from the profile page, with live feedback on how strong the new password is, to keep the account secure. The form has three required fields: current password, new password and confirmation. As the user types the new password, a strength indicator shows the same 5 levels and progress bar as registration. The form rejects a confirmation that doesn't match, a wrong current password and a new password equal to the current one, each with an exact message. A successful change shows a success message and logs the user out after 5 seconds.

## Acceptance criteria

- **AC1 – Change password form**: Given I am on my profile page, then a change password section shows the required fields Current password, New password and Confirm new password.
- **AC2 – Password strength indicator**: Given I enter a new password, then the registration's strength indicator is shown, with the same 5 levels and progress bar.
- **AC3 – Passwords must match**: Given the new password and the confirmation differ, then "Passwords do not match." is shown.
- **AC4 – Current password verification**: Given an incorrect current password, when I submit the form, then "Your current password does not matches with the password." is shown.
- **AC5 – New password must differ**: Given a new password identical to the current one, when I submit the form, then "New Password cannot be same as your current password." is shown.
- **AC6 – Successful change**: Given a valid current password and a new password that matches the confirmation, when I submit the form, then a success message is shown and I am logged out after 5 seconds.

## What it touches

- **API:** `POST /users/change-password` ([Users_API.md](../api/contracts/Users_API.md) §4); `POST /users/login` to read back the new password (§1).
- **UI:** the profile page (`/account/profile`), its "Password" section.
- **Data:** a throwaway customer, registered through the API, for every successful change and for the rejected cases that send a valid new password (API-0291..0293, UI-038); the run's customer for the rest (API-0294..0296, UI-039), where a mistaken success couldn't change its password.

## Test plan

API first: a check goes to the UI only when the API can't prove it ([layer rules](../../.claude/skills/analyze-requirements/references/layer-rules.md)).

| Item | Criterion | What to check | Layer | Why this layer | Flags | Scenarios |
|---|---|---|---|---|---|---|
| T1 | AC1 | The three fields are required. A request without `new_password` or without `new_password_confirmation` (correct current password) is rejected with 422 and an error for that field. A request without `current_password` is rejected with 400 | API | The server enforces it: `required` rules, contract §4 (400/422). The page sends the form without checking that it's valid | writes (setup) | API-0291, API-0292, API-0294 |
| T2 | AC1 | The profile page shows the change-password section with the fields Current Password, New Password and Confirm New Password, and the Change Password button | UI | The section and its labels exist only on the page | | UI-031 |
| T3 | AC2 | Typing new passwords that meet 1, 2, 3, 4 and all 5 criteria highlights Weak, Moderate, Strong, Very Strong and Excellent in turn, with the bar at 20%, 40%, 60%, 80% and 100% (the levels in [User_Registration.md](../ui/user-stories/User_Registration.md) AC4) | UI | No endpoint involved: the page works out the strength in the browser (source) | | UI-032, UI-033, UI-034, UI-035, UI-036 |
| T4 | AC3 | With the correct current password and a confirmation that differs from the new password, the change is rejected with 422 and an error on `new_password` | API | The server enforces matching: contract §4, `confirmed` rule in the source | writes (setup) | API-0293 |
| T5 | AC3 | When the confirmation differs from the new password, "Passwords do not match." appears under the confirmation field | UI | The text is built by the page; the server returns its own 422 message | | UI-037 |
| T6 | AC4 | With a wrong current password, the change is rejected with 400 and `{ success: false, message: "Your current password does not matches with the password." }` | API | The server checks the current password and builds the message (contract §4, source) | | API-0295 |
| T7 | AC4 | Submitting the form with a wrong current password shows "Your current password does not matches with the password." in the error alert | UI | Only the page shows the alert; one case, the rule itself is T6 | writes, data | UI-038 |
| T8 | AC5 | With the correct current password and a new password equal to it, the change is rejected with 400 and `{ success: false, message: "New Password cannot be same as your current password." }` | API | The server compares the passwords and builds the message (contract §4, source) | | API-0296 |
| T9 | AC5 | Submitting the form with a new password equal to the current one shows "New Password cannot be same as your current password." in the error alert | UI | Only the page shows the alert; one case, the rule itself is T8 | | UI-039 |
| T10 | AC6 | With the correct current password and a valid new password that matches the confirmation, the change returns 200 `{ success: true }`, and logging in with the new password then succeeds | API | The server changes and stores the password; reading it back through login proves it (contract §4, §1) | writes, data | API-0290 |
| T11 | AC6 | Journey: on the profile page, submit a valid change and see the success message ("Your password is successfully updated!"); after about 5 seconds the user is logged out (the logged-out navigation shows, the user menu is gone) | UI | The success message, the 5-second timer and the logout run in the browser (source) | writes, data | UI-040 |

**Not tested:** none.

**Totals:** 11 items: 5 API, 6 UI (1 journey); 0 already covered by existing scenarios. Scenarios: 7 API (API-0290..0296 in [post-users-change-password.yml](../../test-scenarios/api/users/post-users-change-password.yml)), 10 UI (UI-031..040 in [change-password.yml](../../test-scenarios/ui/account/change-password.yml), new area `account`).

## Open questions

The user approved the plan without answering these. Each is recorded with the default the plan follows until it's answered.

- **T5, suspected bug (from the source, not reproduced).** `PasswordValidators.passwordsMatch()` is attached to the confirmation control, not to the form group, so the check always passes. The template, though, shows "Passwords do not match." only for a form-level error, so the message probably never appears. The submit button doesn't check whether the form is valid either: a mismatch reaches the server, and the user sees the server's 422 message instead. Default: T5 is written as a plain check, with no bug confirmed yet. Suggested next step: confirm it with `/report-bug`, then add `knownIssue` and `bug` to T5's scenario.
- **AC1 "required":** the page shows no required marker and doesn't block an empty submit. Default: AC1's "required" is covered by the server's rejection (T1). A missing `current_password` gets 400 with the "current password does not matches" message, and that is accepted as the server's behaviour.
- **AC6 "valid new password"** isn't defined in this story; the server applies the registration rules (contract "Strong password"). Default: the weak-password 422 cases are left to the registration tests.
- **AC6, the old password:** default: T10 doesn't check that the old password stops working, because the story doesn't say so explicitly.
- **T9** uses the same alert as T7, with another server message. Default: T9 is kept.
- **Contract §4** holds only `_(source)_` facts. Default: they get tagged `_(verified)_` when T4, T6, T8 and T10 are automated.

## Notes

- **Test data:** T10 and T11 change a password, so each registers its own throwaway customer through the API (`registerThrowawayCustomer`); the run's customer must keep its password. The rejected cases (T1, T4-T9) can use the run's customer, because the server changes nothing for them. A throwaway customer is the safer choice: if the server accepted one by mistake, the run's customer would break for every other test.
- **Error order on the server:** the current password is checked first (400), then new == current (400), then the field rules and the confirmation (422). So T4 and T1 send the correct current password.
- **Page object:** there's none yet for the profile page. The section's data-test ids are `current-password`, `new-password`, `new-password-confirm` and `change-password-submit` (inspector).
- **Not tested** (seen in the source, not in the story): the confirmation field's input handler reads `f['new_password_confirmation']` from the profile form, not the password form. Typing in the confirmation probably throws an error in the browser and leaves the indicator unchanged. Worth a look with `/report-bug`.
- The strength labels show before anything is typed (inspector). That doesn't conflict with AC2.
- **Sources for the layer decisions:** the app's source (`practice-software-testing/sprint5`, read-only) was used only to decide where each rule is enforced: `UserController::changePassword`, `account/profile/profile.component.ts` and `.html`, `_helpers/password.validators.ts`. One inspector run: `/account/profile` as the default role (the section's fields, button and strength labels).
