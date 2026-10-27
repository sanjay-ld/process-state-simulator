# Test Cases

## Core Transition Validation

1. A newly created process starts in NEW.
2. NEW -> READY succeeds.
3. READY -> RUNNING succeeds.
4. RUNNING -> WAITING succeeds.
5. WAITING -> READY succeeds.
6. RUNNING -> READY succeeds.
7. RUNNING -> TERMINATED succeeds.
8. NEW -> RUNNING is rejected.
9. WAITING -> RUNNING is rejected.
10. TERMINATED -> READY is rejected.
11. A terminated process cannot be restarted.
12. Summary statistics update correctly.
13. Multiple processes are handled correctly.
14. Round Robin scheduling never runs two processes simultaneously.
15. Pause and resume work correctly.
16. Reset stops the simulation and restores a clean initial state.
17. Export functions produce valid CSV content.
18. No JavaScript runtime errors appear during normal usage.

## Validation Approach

- Use the process controls to invoke valid and invalid transitions.
- Check whether the state badge and stats update correctly.
- Activate the scheduler and confirm only one process is ever RUNNING at a time.
- Trigger invalid transitions and verify that the process data remains unchanged.
- Export logs and process data and inspect the generated CSV output.
