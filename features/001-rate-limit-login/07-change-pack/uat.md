# UAT — Rate-limit login attempts

| ID | Scenario | Result | Evidence |
|---|---|---|---|
| REQ-1 | Support analyst fails login 6× on test account in staging | pass | `evidence/uat-req1.png` |
| REQ-2 | Load tool sends 51 failures from one IP | pass | `evidence/uat-req2.txt` |
| REQ-3 | Wait 10 min, login succeeds | pass | `evidence/uat-req3.png` |
| REQ-4 | Compare 429 bodies for real and fake account | pass | `evidence/uat-req4.diff` (identical) |
