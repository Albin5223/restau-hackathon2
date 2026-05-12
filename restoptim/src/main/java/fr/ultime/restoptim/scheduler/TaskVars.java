package fr.ultime.restoptim.scheduler;

import com.google.ortools.sat.IntVar;
import com.google.ortools.sat.IntervalVar;

record TaskVars(IntVar start, IntVar end, IntervalVar interval) {
}
