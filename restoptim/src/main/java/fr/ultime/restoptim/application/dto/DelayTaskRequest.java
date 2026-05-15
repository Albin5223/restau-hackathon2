package fr.ultime.restoptim.application.dto;

public record DelayTaskRequest(String ganttTaskId, int additionalSeconds) {}
