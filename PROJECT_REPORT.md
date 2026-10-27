# Process State Transition Simulator

## Title Page Details

- Student Name: ___________________
- Register Number: ___________________
- Department: Computer Science and Engineering
- College: ___________________
- Academic Year: 2025-2026

## Abstract

This project implements a browser-based simulator for demonstrating the lifecycle of operating system processes. It provides an interactive visual model of the standard five states: NEW, READY, RUNNING, WAITING, and TERMINATED. The simulator combines a process table, state diagram, scheduler controls, and educational content to explain how an operating system schedules, preempts, and terminates processes.

## Introduction

Operating systems manage system resources, including CPU time, memory, and I/O devices. A process is a running instance of a program that moves among states as it executes. Understanding these transitions is fundamental to OS studies. This simulator helps students visualize process behavior and transition rules in a controlled environment.

## Problem Statement

Students often find abstract OS concepts difficult to relate to actual system behavior. A visual and interactive simulator can simplify these ideas, allowing learners to observe scheduling, preemption, I/O blocking, and termination in a realistic but safe simulation.

## Objectives

- Demonstrate the five standard process states.
- Show valid and invalid process transitions.
- Explain how the ready queue and CPU scheduler work.
- Simulate context switching and I/O wait behavior.
- Provide an educational dashboard suitable for class demonstration.

## Existing System and Proposed System

### Existing System
Most classroom explanations rely on static notes and diagrams. These methods may not show the impact of preemption, waiting, and scheduling decisions in a dynamic way.

### Proposed System
The proposed simulator gives students an interactive environment with live process data, transition validation, and a simple Round Robin scheduler. It helps learners connect theory to actual lifecycle behavior without requiring the complexity of a real operating system kernel.

## Hardware and Software Requirements

- Desktop or laptop with a modern web browser
- Internet access for optional font loading or local browser execution
- Python 3 installed for local web server hosting
- No database or backend required

## System Architecture

The application uses a front-end architecture based on HTML, CSS, and JavaScript. The UI is composed of dashboard sections for summary cards, process tables, a transition diagram, and educational content. JavaScript manages process lifecycle logic, validation functions, scheduler behavior, logs, and LocalStorage persistence.

## Process State Diagram

The state diagram visually represents the following lifecycle:

NEW -> READY -> RUNNING -> TERMINATED

Additional valid and educational transitions include:

- RUNNING -> READY (preemption)
- RUNNING -> WAITING (I/O request)
- WAITING -> READY (I/O completion)

## Algorithms and Transition Rules

The simulator uses a centralized validation function to ensure only legal transitions occur. The following rules are enforced:

- NEW -> READY
- READY -> RUNNING
- RUNNING -> READY
- RUNNING -> WAITING
- WAITING -> READY
- RUNNING -> TERMINATED

All other transitions are rejected to protect process integrity. TERMINATED is a permanent final state and cannot be reactivated.

## Implementation Details

The application is implemented as a single-page web interface. It includes:

- dynamic state counts
- a process table with search and filters
- event logs with CSV export
- process control buttons for state transitions
- a Round Robin scheduler with configurable time quantum
- LocalStorage persistence for quick continuation

## Testing and Results

The project was tested using manual browser interaction and validation of key state transitions. The critical scenarios were checked for both success and rejection behavior. The scheduler was tested to ensure only a single process is active in the RUNNING state at a time.

## Limitations

This is a simulation used for teaching and visualization. It does not replicate all features of a real operating system, such as memory management, multi-core scheduling, race conditions, or kernel-level synchronization.

## Future Enhancements

- support for multiple scheduling algorithms
- process priority scheduling
- memory allocation simulation
- better animation for each transition
- richer resource contention scenarios

## Conclusion

The Process State Transition Simulator successfully explains the lifecycle of a process using an interactive and student-friendly interface. It offers a practical educational experience that aligns with the principles of operating systems theory while remaining simple enough for demonstration in the classroom.

## References

1. Silberschatz, A., Galvin, P. B., and Gagne, G. Operating System Concepts.
2. Stallings, W. Operating Systems: Internals and Design Principles.
3. Tanenbaum, A. S., and Bos, H. Modern Operating Systems.
4. https://en.wikipedia.org/wiki/Process_state
