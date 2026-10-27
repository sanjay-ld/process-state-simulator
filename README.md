# Process State Transition Simulator

A browser-based operating systems mini-project that visualizes how processes move through the standard lifecycle states: NEW, READY, RUNNING, WAITING, and TERMINATED.

## Features

- Interactive SVG state transition diagram
- Manual process creation and lifecycle control
- Centralized transition validation
- Round Robin CPU scheduling simulation with configurable quantum
- Ready queue, current process, and CPU timeline view
- Searchable/filterable process table
- Event log with CSV export
- LocalStorage persistence
- Educational learning section with guided demo

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript
- SVG for state diagrams
- LocalStorage for persistence

## How to Run

1. Open a terminal in this project folder.
2. Run:
   ```bash
   python -m http.server 8000
   ```
3. Open http://localhost:8000 in a browser.

## Project Structure

```text
process-state-simulator/
├── index.html
├── styles.css
├── script.js
├── README.md
├── PROJECT_REPORT.md
├── TEST_CASES.md
```

## Operating the Simulator

- Create a process with a name, priority, and burst time.
- Select a process from the table to access state-specific controls.
- Use the lifecycle buttons to move a process through valid transitions.
- Start the scheduler to simulate Round Robin CPU execution.
- Pause, resume, or step through scheduling activity.
- Reset the simulation to restore the default demo state.

## Notes

This is a simulated educational tool and not a real operating system kernel.
