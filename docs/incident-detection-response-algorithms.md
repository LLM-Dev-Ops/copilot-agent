# Incident Detection and Response Algorithms

**Version:** 1.0.0
**Status:** Design Document
**Last Updated:** 2025-11-25

---

## Table of Contents

1. [Anomaly Detector](#1-anomaly-detector)
2. [Severity Classifier](#2-severity-classifier)
3. [Automated Triage](#3-automated-triage)
4. [Response Coordinator](#4-response-coordinator)
5. [Post-Incident Analyzer](#5-post-incident-analyzer)
6. [Data Structures](#6-data-structures)
7. [Error Handling](#7-error-handling)

---

## Performance Targets

Based on specification requirements:
- **Detection Rate:** 75% of incidents detected before user impact
- **MTTR Reduction:** 50% reduction in mean-time-to-resolution
- **Classification Accuracy:** 90% accuracy in incident severity classification
- **False Positive Rate:** <10% for anomaly detection
- **Auto-Resolution:** 30% of incidents auto-resolved without human intervention

---

## 1. Anomaly Detector

### 1.1 Core Anomaly Detection Algorithm

```pseudocode
PROCEDURE DetectAnomalies(
    agent: Agent,
    timeWindow: TimeRange,
    signals: List<SignalSource>
) -> List<Anomaly>:
    // Multi-signal anomaly detection with correlation

    span = StartSpan(agent.telemetry, "anomaly_detection")
    detectedAnomalies = []

    TRY
        // Step 1: Collect signals from all sources
        metricsData = CollectMetricsSignals(agent, timeWindow, signals)
        logsData = CollectLogSignals(agent, timeWindow, signals)
        tracesData = CollectTraceSignals(agent, timeWindow, signals)

        // Step 2: Run parallel detection on each signal type
        metricAnomalies = SpawnTask(DetectMetricAnomalies, agent, metricsData)
        logAnomalies = SpawnTask(DetectLogAnomalies, agent, logsData)
        traceAnomalies = SpawnTask(DetectTraceAnomalies, agent, tracesData)

        // Wait for all detection tasks
        WaitForTasks([metricAnomalies, logAnomalies, traceAnomalies])

        // Step 3: Combine anomalies
        allAnomalies = metricAnomalies.GetResult() +
                       logAnomalies.GetResult() +
                       traceAnomalies.GetResult()

        // Step 4: Correlate across signals
        correlatedAnomalies = CorrelateAnomalies(agent, allAnomalies, timeWindow)

        // Step 5: Apply false positive reduction
        filteredAnomalies = ReduceFalsePositives(agent, correlatedAnomalies)

        // Step 6: Score and rank by severity
        rankedAnomalies = RankAnomaliesBySeverity(agent, filteredAnomalies)

        // Step 7: Store for historical analysis
        FOR EACH anomaly IN rankedAnomalies DO
            StoreAnomaly(agent.storage.db, anomaly)
        END FOR

        // Step 8: Record metrics
        RecordMetric(agent.metrics, "anomalies.detected", rankedAnomalies.Length, {
            timeWindow: timeWindow,
            signalCount: signals.Length
        })

        RETURN rankedAnomalies

    CATCH error AS Exception:
        LogError(agent.audit, error, "anomaly_detection_error")
        THROW error

    FINALLY
        EndSpan(span)
    END TRY
END PROCEDURE
```

### 1.2 Metric Anomaly Detection

```pseudocode
PROCEDURE DetectMetricAnomalies(
    agent: Agent,
    metricsData: Map<String, TimeSeries>
) -> List<Anomaly>:
    // Detect anomalies in time-series metrics using multiple methods

    anomalies = []

    FOR EACH metricName, timeSeries IN metricsData DO
        // Skip if insufficient data
        IF timeSeries.Length < agent.config.minDataPoints THEN
            CONTINUE
        END IF

        // Step 1: Calculate baseline
        baseline = CalculateBaseline(agent, timeSeries, metricName)

        // Step 2: Apply statistical methods
        zScoreAnomalies = DetectZScoreAnomalies(timeSeries, baseline)
        iqrAnomalies = DetectIQRAnomalies(timeSeries, baseline)

        // Step 3: Apply ML-based detection
        mlAnomalies = []
        IF agent.config.mlDetectionEnabled THEN
            mlAnomalies = DetectMLAnomalies(agent, timeSeries, metricName)
        END IF

        // Step 4: Detect trend changes
        trendAnomalies = DetectTrendChanges(timeSeries, baseline)

        // Step 5: Combine detections with confidence scoring
        metricAnomalies = CombineDetectionMethods(
            zScoreAnomalies,
            iqrAnomalies,
            mlAnomalies,
            trendAnomalies,
            metricName
        )

        anomalies.AddAll(metricAnomalies)
    END FOR

    RETURN anomalies
END PROCEDURE
```

### 1.3 Baseline Calculation

```pseudocode
PROCEDURE CalculateBaseline(
    agent: Agent,
    timeSeries: TimeSeries,
    metricName: String
) -> Baseline:
    // Calculate baseline with seasonal and trend decomposition

    // Step 1: Load historical baseline if exists
    historicalBaseline = LoadBaseline(agent.storage.db, metricName)

    // Step 2: Determine seasonality period
    seasonalityPeriod = DetectSeasonality(timeSeries)

    // Step 3: Decompose time series
    trend = CalculateTrend(timeSeries)
    seasonal = CalculateSeasonalComponent(timeSeries, seasonalityPeriod)
    residual = CalculateResidual(timeSeries, trend, seasonal)

    // Step 4: Calculate statistical properties
    mean = CalculateMean(timeSeries)
    median = CalculateMedian(timeSeries)
    stdDev = CalculateStdDev(timeSeries)
    q1 = CalculatePercentile(timeSeries, 25)
    q3 = CalculatePercentile(timeSeries, 75)
    iqr = q3 - q1

    // Step 5: Calculate dynamic thresholds
    upperThreshold = mean + (agent.config.stdDevThreshold * stdDev)
    lowerThreshold = mean - (agent.config.stdDevThreshold * stdDev)

    // Adjust for seasonality
    IF seasonalityPeriod > 0 THEN
        upperThreshold = AdjustForSeasonality(upperThreshold, seasonal)
        lowerThreshold = AdjustForSeasonality(lowerThreshold, seasonal)
    END IF

    // Step 6: Create baseline object
    baseline = NEW Baseline(
        metricName: metricName,
        mean: mean,
        median: median,
        stdDev: stdDev,
        iqr: iqr,
        upperThreshold: upperThreshold,
        lowerThreshold: lowerThreshold,
        trend: trend,
        seasonal: seasonal,
        seasonalityPeriod: seasonalityPeriod,
        calculatedAt: CurrentTimestamp(),
        dataPoints: timeSeries.Length
    )

    // Step 7: Update stored baseline with exponential decay
    IF historicalBaseline != NULL THEN
        baseline = MergeBaselines(
            historicalBaseline,
            baseline,
            decayFactor: agent.config.baselineDecayFactor
        )
    END IF

    // Step 8: Store updated baseline
    StoreBaseline(agent.storage.db, metricName, baseline)

    RETURN baseline
END PROCEDURE
```

### 1.4 Z-Score Anomaly Detection

```pseudocode
PROCEDURE DetectZScoreAnomalies(
    timeSeries: TimeSeries,
    baseline: Baseline
) -> List<Anomaly>:
    // Statistical anomaly detection using z-score method

    anomalies = []
    zScoreThreshold = 3.0  // Standard threshold (99.7% confidence)

    FOR EACH point IN timeSeries DO
        // Calculate z-score
        zScore = (point.value - baseline.mean) / baseline.stdDev

        // Check if anomalous
        IF ABS(zScore) > zScoreThreshold THEN
            // Determine direction
            direction = IF zScore > 0 THEN "spike" ELSE "drop"

            // Calculate confidence
            confidence = CalculateZScoreConfidence(zScore, zScoreThreshold)

            // Create anomaly
            anomaly = NEW Anomaly(
                type: "metric",
                detectionMethod: "z-score",
                metricName: baseline.metricName,
                timestamp: point.timestamp,
                value: point.value,
                expectedValue: baseline.mean,
                deviation: zScore,
                direction: direction,
                confidence: confidence,
                severity: CalculateSeverityFromZScore(zScore)
            )

            anomalies.Append(anomaly)
        END IF
    END FOR

    RETURN anomalies
END PROCEDURE
```

### 1.5 IQR Anomaly Detection

```pseudocode
PROCEDURE DetectIQRAnomalies(
    timeSeries: TimeSeries,
    baseline: Baseline
) -> List<Anomaly>:
    // Robust anomaly detection using Interquartile Range method

    anomalies = []
    multiplier = 1.5  // Standard IQR multiplier

    // Calculate bounds
    lowerBound = baseline.q1 - (multiplier * baseline.iqr)
    upperBound = baseline.q3 + (multiplier * baseline.iqr)

    FOR EACH point IN timeSeries DO
        // Check if outside bounds
        IF point.value < lowerBound OR point.value > upperBound THEN
            // Determine direction and magnitude
            direction = IF point.value > upperBound THEN "spike" ELSE "drop"

            IF direction == "spike" THEN
                deviation = (point.value - upperBound) / baseline.iqr
            ELSE
                deviation = (lowerBound - point.value) / baseline.iqr
            END IF

            // Calculate confidence
            confidence = CalculateIQRConfidence(deviation)

            // Create anomaly
            anomaly = NEW Anomaly(
                type: "metric",
                detectionMethod: "iqr",
                metricName: baseline.metricName,
                timestamp: point.timestamp,
                value: point.value,
                expectedValue: baseline.median,
                deviation: deviation,
                direction: direction,
                confidence: confidence,
                severity: CalculateSeverityFromDeviation(deviation)
            )

            anomalies.Append(anomaly)
        END IF
    END FOR

    RETURN anomalies
END PROCEDURE
```

### 1.6 ML-Based Pattern Recognition

```pseudocode
PROCEDURE DetectMLAnomalies(
    agent: Agent,
    timeSeries: TimeSeries,
    metricName: String
) -> List<Anomaly>:
    // Machine learning-based anomaly detection

    anomalies = []

    // Step 1: Load or initialize ML model
    model = LoadMLModel(agent.storage.db, metricName)

    IF model == NULL THEN
        // Initialize with default model
        model = InitializeIsolationForest(
            contamination: 0.01,  // Expected anomaly rate
            nEstimators: 100
        )
    END IF

    // Step 2: Prepare features
    features = ExtractFeatures(timeSeries)
    // Features include: value, time_of_day, day_of_week,
    // rolling_mean, rolling_std, lag_values, rate_of_change

    // Step 3: Retrain model periodically
    IF ShouldRetrainModel(model, agent.config.retrainInterval) THEN
        historicalData = LoadHistoricalData(agent.storage.db, metricName)
        historicalFeatures = ExtractFeatures(historicalData)

        model.Fit(historicalFeatures)
        SaveMLModel(agent.storage.db, metricName, model)
    END IF

    // Step 4: Predict anomalies
    predictions = model.Predict(features)
    scores = model.AnomalyScore(features)

    // Step 5: Create anomaly objects
    FOR i = 0 TO predictions.Length DO
        IF predictions[i] == -1 THEN  // Anomaly detected
            point = timeSeries[i]

            // Calculate confidence from anomaly score
            confidence = NormalizeAnomalyScore(scores[i])

            anomaly = NEW Anomaly(
                type: "metric",
                detectionMethod: "ml-isolation-forest",
                metricName: metricName,
                timestamp: point.timestamp,
                value: point.value,
                expectedValue: EstimateExpectedValue(model, features[i]),
                confidence: confidence,
                severity: CalculateSeverityFromScore(scores[i]),
                mlScore: scores[i]
            )

            anomalies.Append(anomaly)
        END IF
    END FOR

    RETURN anomalies
END PROCEDURE
```

### 1.7 Log Pattern Anomaly Detection

```pseudocode
PROCEDURE DetectLogAnomalies(
    agent: Agent,
    logsData: List<LogEntry>
) -> List<Anomaly>:
    // Detect anomalies in log patterns

    anomalies = []

    // Step 1: Group logs by pattern
    logPatterns = GroupLogsByPattern(logsData)

    // Step 2: Calculate baselines for each pattern
    FOR EACH pattern, logs IN logPatterns DO
        baseline = CalculateLogBaseline(agent, pattern, logs)

        // Step 3: Detect volume anomalies
        volumeAnomalies = DetectLogVolumeAnomalies(logs, baseline)
        anomalies.AddAll(volumeAnomalies)

        // Step 4: Detect new error patterns
        newErrorAnomalies = DetectNewErrorPatterns(agent, logs, pattern)
        anomalies.AddAll(newErrorAnomalies)

        // Step 5: Detect rare events
        rareEventAnomalies = DetectRareEvents(agent, logs, pattern)
        anomalies.AddAll(rareEventAnomalies)
    END FOR

    // Step 6: Detect error rate spikes
    errorRateAnomalies = DetectErrorRateSpikes(agent, logsData)
    anomalies.AddAll(errorRateAnomalies)

    RETURN anomalies
END PROCEDURE
```

### 1.8 Trace Anomaly Detection

```pseudocode
PROCEDURE DetectTraceAnomalies(
    agent: Agent,
    tracesData: List<Trace>
) -> List<Anomaly>:
    // Detect anomalies in distributed traces

    anomalies = []

    // Step 1: Group traces by operation
    traceGroups = GroupTracesByOperation(tracesData)

    FOR EACH operation, traces IN traceGroups DO
        // Step 2: Calculate latency baseline
        latencyBaseline = CalculateLatencyBaseline(agent, operation, traces)

        // Step 3: Detect latency anomalies
        latencyAnomalies = DetectLatencyAnomalies(traces, latencyBaseline)
        anomalies.AddAll(latencyAnomalies)

        // Step 4: Detect span anomalies
        spanAnomalies = DetectSpanAnomalies(agent, traces)
        anomalies.AddAll(spanAnomalies)

        // Step 5: Detect dependency changes
        dependencyAnomalies = DetectDependencyAnomalies(agent, traces, operation)
        anomalies.AddAll(dependencyAnomalies)
    END FOR

    // Step 6: Detect error rate anomalies
    errorAnomalies = DetectTraceErrorAnomalies(agent, tracesData)
    anomalies.AddAll(errorAnomalies)

    RETURN anomalies
END PROCEDURE
```

### 1.9 Cross-Signal Correlation

```pseudocode
PROCEDURE CorrelateAnomalies(
    agent: Agent,
    anomalies: List<Anomaly>,
    timeWindow: TimeRange
) -> List<CorrelatedAnomaly>:
    // Correlate anomalies across different signals

    correlatedAnomalies = []

    // Step 1: Group anomalies by service and time proximity
    timeProximityThreshold = 60  // seconds
    anomalyGroups = GroupByTimeProximity(anomalies, timeProximityThreshold)

    FOR EACH group IN anomalyGroups DO
        // Step 2: Extract services involved
        services = ExtractServicesFromAnomalies(group)

        // Step 3: Calculate correlation strength
        correlationMatrix = CalculateCorrelationMatrix(group)

        // Step 4: Identify primary anomaly
        primaryAnomaly = IdentifyPrimaryAnomaly(group, correlationMatrix)

        // Step 5: Identify cascading effects
        cascadingAnomalies = IdentifyCascadingEffects(group, primaryAnomaly)

        // Step 6: Calculate combined severity
        combinedSeverity = CalculateCombinedSeverity(group)

        // Step 7: Determine blast radius
        blastRadius = CalculateBlastRadius(agent, services, group)

        // Step 8: Create correlated anomaly
        correlated = NEW CorrelatedAnomaly(
            id: GenerateAnomalyID(),
            primaryAnomaly: primaryAnomaly,
            relatedAnomalies: cascadingAnomalies,
            services: services,
            timeWindow: GetTimeWindowForGroup(group),
            correlationStrength: CalculateAverageCorrelation(correlationMatrix),
            combinedSeverity: combinedSeverity,
            blastRadius: blastRadius,
            confidence: CalculateGroupConfidence(group)
        )

        correlatedAnomalies.Append(correlated)
    END FOR

    RETURN correlatedAnomalies
END PROCEDURE
```

### 1.10 False Positive Reduction

```pseudocode
PROCEDURE ReduceFalsePositives(
    agent: Agent,
    anomalies: List<CorrelatedAnomaly>
) -> List<CorrelatedAnomaly>:
    // Apply filters to reduce false positive rate

    filteredAnomalies = []

    FOR EACH anomaly IN anomalies DO
        // Filter 1: Confidence threshold
        IF anomaly.confidence < agent.config.minConfidenceThreshold THEN
            RecordMetric(agent.metrics, "anomaly.filtered.low_confidence", 1)
            CONTINUE
        END IF

        // Filter 2: Check against known maintenance windows
        IF IsInMaintenanceWindow(agent, anomaly.services, anomaly.timeWindow) THEN
            RecordMetric(agent.metrics, "anomaly.filtered.maintenance", 1)
            CONTINUE
        END IF

        // Filter 3: Check against recent deployments
        recentDeployments = GetRecentDeployments(agent, anomaly.services, anomaly.timeWindow)
        IF recentDeployments.Length > 0 AND IsExpectedPostDeployment(anomaly) THEN
            // Expected anomaly after deployment
            anomaly.metadata["deployment_related"] = true
            anomaly.confidence *= 0.7  // Reduce confidence
        END IF

        // Filter 4: Historical false positive check
        historicalFP = CheckHistoricalFalsePositive(agent, anomaly)
        IF historicalFP.isFalsePositive THEN
            IF historicalFP.confidence > 0.8 THEN
                RecordMetric(agent.metrics, "anomaly.filtered.historical_fp", 1)
                CONTINUE
            END IF
        END IF

        // Filter 5: User feedback learning
        userFeedback = GetUserFeedbackForSimilarAnomalies(agent, anomaly)
        IF userFeedback.dismissalRate > 0.7 THEN
            anomaly.confidence *= (1.0 - userFeedback.dismissalRate)
        END IF

        // Filter 6: Check if already acknowledged incident
        existingIncident = FindExistingIncident(agent, anomaly)
        IF existingIncident != NULL THEN
            // Link to existing incident instead of creating new
            anomaly.linkedIncidentId = existingIncident.id
        END IF

        filteredAnomalies.Append(anomaly)
    END FOR

    // Calculate false positive reduction metrics
    reductionRate = 1.0 - (filteredAnomalies.Length / anomalies.Length)
    RecordMetric(agent.metrics, "anomaly.fp_reduction_rate", reductionRate)

    RETURN filteredAnomalies
END PROCEDURE
```

---

## 2. Severity Classifier

### 2.1 Core Severity Classification

```pseudocode
PROCEDURE ClassifySeverity(
    agent: Agent,
    anomaly: CorrelatedAnomaly
) -> SeverityClassification:
    // Classify incident severity with confidence scoring

    span = StartSpan(agent.telemetry, "severity_classification")

    TRY
        // Step 1: Calculate impact factors
        impactFactors = CalculateImpactFactors(agent, anomaly)

        // Step 2: Assess user-facing impact
        userImpact = AssessUserImpact(agent, anomaly)

        // Step 3: Check SLO/SLA breaches
        sloBreaches = CheckSLOBreaches(agent, anomaly)

        // Step 4: Correlate with historical incidents
        historicalCorrelation = CorrelateWithHistoricalIncidents(agent, anomaly)

        // Step 5: Calculate base severity score
        baseSeverity = CalculateBaseSeverityScore(
            impactFactors,
            userImpact,
            sloBreaches,
            historicalCorrelation
        )

        // Step 6: Apply business context adjustments
        adjustedSeverity = ApplyBusinessContext(agent, baseSeverity, anomaly)

        // Step 7: Determine severity level
        severityLevel = DetermineSeverityLevel(adjustedSeverity)

        // Step 8: Calculate confidence score
        confidence = CalculateClassificationConfidence(
            impactFactors,
            userImpact,
            sloBreaches,
            historicalCorrelation
        )

        // Step 9: Determine escalation triggers
        escalationTriggers = DetermineEscalationTriggers(
            severityLevel,
            confidence,
            anomaly
        )

        // Step 10: Create classification object
        classification = NEW SeverityClassification(
            level: severityLevel,
            score: adjustedSeverity,
            confidence: confidence,
            impactFactors: impactFactors,
            userImpact: userImpact,
            sloBreaches: sloBreaches,
            escalationTriggers: escalationTriggers,
            classifiedAt: CurrentTimestamp(),
            classifier: "automated"
        )

        // Step 11: Record metrics
        RecordMetric(agent.metrics, "severity.classified", 1, {
            level: severityLevel,
            confidence: confidence
        })

        RETURN classification

    FINALLY
        EndSpan(span)
    END TRY
END PROCEDURE
```

### 2.2 Impact Factor Calculation

```pseudocode
PROCEDURE CalculateImpactFactors(
    agent: Agent,
    anomaly: CorrelatedAnomaly
) -> ImpactFactors:
    // Calculate multiple impact factors for severity assessment

    factors = NEW ImpactFactors()

    // Factor 1: Blast radius (number of affected services)
    factors.blastRadius = anomaly.blastRadius
    factors.blastRadiusScore = NormalizeBlastRadius(
        anomaly.blastRadius,
        agent.config.totalServices
    )

    // Factor 2: Traffic impact
    affectedServices = anomaly.services
    totalTraffic = 0
    affectedTraffic = 0

    FOR EACH service IN affectedServices DO
        serviceTraffic = GetCurrentTraffic(agent, service)
        affectedTraffic += serviceTraffic
    END FOR

    totalTraffic = GetTotalSystemTraffic(agent)
    factors.trafficImpact = affectedTraffic / totalTraffic

    // Factor 3: Error rate increase
    baselineErrorRate = GetBaselineErrorRate(agent, affectedServices)
    currentErrorRate = GetCurrentErrorRate(agent, affectedServices)
    factors.errorRateIncrease = (currentErrorRate - baselineErrorRate) / baselineErrorRate

    // Factor 4: Latency degradation
    baselineLatency = GetBaselineLatency(agent, affectedServices)
    currentLatency = GetCurrentLatency(agent, affectedServices)
    factors.latencyDegradation = (currentLatency - baselineLatency) / baselineLatency

    // Factor 5: Availability impact
    factors.availabilityImpact = CalculateAvailabilityImpact(agent, affectedServices)

    // Factor 6: Critical service involvement
    factors.criticalServiceInvolved = HasCriticalServices(
        agent,
        affectedServices,
        agent.config.criticalServices
    )

    // Factor 7: Customer count affected
    factors.affectedCustomers = EstimateAffectedCustomers(agent, affectedServices)

    // Factor 8: Revenue impact
    factors.estimatedRevenueImpact = EstimateRevenueImpact(
        agent,
        affectedServices,
        factors.affectedCustomers
    )

    // Factor 9: Data integrity risk
    factors.dataIntegrityRisk = AssessDataIntegrityRisk(agent, anomaly)

    // Factor 10: Security implications
    factors.securityRisk = AssessSecurityRisk(agent, anomaly)

    RETURN factors
END PROCEDURE
```

### 2.3 User Impact Assessment

```pseudocode
PROCEDURE AssessUserImpact(
    agent: Agent,
    anomaly: CorrelatedAnomaly
) -> UserImpact:
    // Assess whether incident is user-facing or internal

    impact = NEW UserImpact()

    // Step 1: Determine if services are user-facing
    userFacingServices = FilterUserFacingServices(
        agent,
        anomaly.services,
        agent.config.userFacingServices
    )

    impact.isUserFacing = userFacingServices.Length > 0

    IF NOT impact.isUserFacing THEN
        impact.impactLevel = "internal"
        impact.priority = "medium"
        RETURN impact
    END IF

    // Step 2: Calculate user-facing severity

    // Check if critical user journeys are affected
    affectedJourneys = IdentifyAffectedUserJourneys(
        agent,
        userFacingServices
    )

    impact.affectedJourneys = affectedJourneys
    impact.criticalJourneyAffected = HasCriticalJourneys(
        affectedJourneys,
        agent.config.criticalUserJourneys
    )

    // Step 3: Estimate user experience degradation
    impact.uxDegradation = CalculateUXDegradation(
        agent,
        userFacingServices,
        anomaly
    )

    // Step 4: Check active user sessions
    impact.activeSessionsAffected = CountActiveSessionsAffected(
        agent,
        userFacingServices
    )

    // Step 5: Assess business hours impact
    impact.isDuringBusinessHours = IsBusinessHours(
        agent.config.businessHours,
        CurrentTimestamp()
    )

    // Step 6: Calculate user complaints/reports
    impact.userComplaints = GetRecentUserComplaints(
        agent,
        anomaly.timeWindow
    )

    // Step 7: Determine impact level
    IF impact.criticalJourneyAffected THEN
        impact.impactLevel = "critical"
        impact.priority = "high"
    ELSE IF impact.uxDegradation > 0.5 THEN
        impact.impactLevel = "major"
        impact.priority = "high"
    ELSE IF impact.uxDegradation > 0.2 THEN
        impact.impactLevel = "moderate"
        impact.priority = "medium"
    ELSE
        impact.impactLevel = "minor"
        impact.priority = "low"
    END IF

    // Boost priority during business hours
    IF impact.isDuringBusinessHours AND impact.priority == "medium" THEN
        impact.priority = "high"
    END IF

    RETURN impact
END PROCEDURE
```

### 2.4 SLO/SLA Breach Detection

```pseudocode
PROCEDURE CheckSLOBreaches(
    agent: Agent,
    anomaly: CorrelatedAnomaly
) -> List<SLOBreach>:
    // Check if incident breaches SLO/SLA thresholds

    breaches = []

    // Step 1: Get SLO definitions for affected services
    FOR EACH service IN anomaly.services DO
        slos = GetServiceSLOs(agent.storage.db, service)

        FOR EACH slo IN slos DO
            // Step 2: Calculate current SLO compliance
            currentValue = GetCurrentSLOValue(agent, service, slo)

            // Step 3: Check if breach occurred
            isBreached = false

            SWITCH slo.type:
                CASE "availability":
                    isBreached = currentValue < slo.target

                CASE "latency":
                    isBreached = currentValue > slo.target

                CASE "error_rate":
                    isBreached = currentValue > slo.target

                CASE "throughput":
                    isBreached = currentValue < slo.target
            END SWITCH

            IF isBreached THEN
                // Step 4: Calculate breach severity
                breachMagnitude = CalculateBreachMagnitude(
                    currentValue,
                    slo.target,
                    slo.type
                )

                // Step 5: Check error budget consumption
                errorBudget = GetErrorBudget(agent, service, slo)
                budgetRemaining = errorBudget.remaining

                // Step 6: Project time to SLA breach
                sla = GetServiceSLA(agent.storage.db, service)
                timeToSLABreach = NULL

                IF sla != NULL THEN
                    timeToSLABreach = ProjectTimeToSLABreach(
                        currentValue,
                        sla.target,
                        anomaly
                    )
                END IF

                // Step 7: Create breach record
                breach = NEW SLOBreach(
                    service: service,
                    slo: slo,
                    sla: sla,
                    currentValue: currentValue,
                    targetValue: slo.target,
                    breachMagnitude: breachMagnitude,
                    errorBudgetRemaining: budgetRemaining,
                    timeToSLABreach: timeToSLABreach,
                    breachedAt: CurrentTimestamp(),
                    severity: CalculateSLOBreachSeverity(
                        breachMagnitude,
                        budgetRemaining,
                        timeToSLABreach
                    )
                )

                breaches.Append(breach)
            END IF
        END FOR
    END FOR

    // Step 8: Record metrics
    RecordMetric(agent.metrics, "slo.breaches", breaches.Length, {
        services: anomaly.services
    })

    RETURN breaches
END PROCEDURE
```

### 2.5 Historical Incident Correlation

```pseudocode
PROCEDURE CorrelateWithHistoricalIncidents(
    agent: Agent,
    anomaly: CorrelatedAnomaly
) -> HistoricalCorrelation:
    // Find similar historical incidents for context

    // Step 1: Extract anomaly signature
    signature = ExtractAnomalySignature(anomaly)

    // Step 2: Search for similar incidents
    similarIncidents = SearchSimilarIncidents(
        agent.storage.db,
        signature,
        limit: 10
    )

    IF similarIncidents.Length == 0 THEN
        RETURN NEW HistoricalCorrelation(
            hasSimilarIncidents: false,
            confidence: 0.0
        )
    END IF

    // Step 3: Calculate similarity scores
    scoredIncidents = []
    FOR EACH incident IN similarIncidents DO
        similarityScore = CalculateSimilarityScore(anomaly, incident)
        scoredIncidents.Append({
            incident: incident,
            similarity: similarityScore
        })
    END FOR

    // Sort by similarity
    SortByScoreDescending(scoredIncidents)

    // Step 4: Get most similar incident
    mostSimilar = scoredIncidents[0]

    // Step 5: Extract patterns
    commonServices = IntersectServices(
        anomaly.services,
        mostSimilar.incident.services
    )

    averageSeverity = CalculateAverageSeverity(scoredIncidents)
    averageResolutionTime = CalculateAverageResolutionTime(scoredIncidents)

    // Step 6: Extract successful remediation actions
    remediationPatterns = ExtractRemediationPatterns(scoredIncidents)

    // Step 7: Create correlation object
    correlation = NEW HistoricalCorrelation(
        hasSimilarIncidents: true,
        mostSimilarIncident: mostSimilar.incident,
        similarityScore: mostSimilar.similarity,
        matchCount: similarIncidents.Length,
        commonServices: commonServices,
        averageSeverity: averageSeverity,
        averageResolutionTime: averageResolutionTime,
        remediationPatterns: remediationPatterns,
        confidence: CalculateCorrelationConfidence(mostSimilar.similarity)
    )

    RETURN correlation
END PROCEDURE
```

### 2.6 Severity Score Calculation

```pseudocode
PROCEDURE CalculateBaseSeverityScore(
    impactFactors: ImpactFactors,
    userImpact: UserImpact,
    sloBreaches: List<SLOBreach>,
    historicalCorrelation: HistoricalCorrelation
) -> Float:
    // Calculate severity score from 0.0 (no impact) to 1.0 (critical)

    score = 0.0
    weights = LoadSeverityWeights()

    // Component 1: Blast radius (weight: 0.15)
    score += impactFactors.blastRadiusScore * weights.blastRadius

    // Component 2: Traffic impact (weight: 0.15)
    score += impactFactors.trafficImpact * weights.traffic

    // Component 3: Error rate (weight: 0.15)
    normalizedErrorRate = MIN(impactFactors.errorRateIncrease / 10.0, 1.0)
    score += normalizedErrorRate * weights.errorRate

    // Component 4: Latency degradation (weight: 0.10)
    normalizedLatency = MIN(impactFactors.latencyDegradation / 5.0, 1.0)
    score += normalizedLatency * weights.latency

    // Component 5: Availability impact (weight: 0.15)
    score += impactFactors.availabilityImpact * weights.availability

    // Component 6: User impact (weight: 0.15)
    IF userImpact.isUserFacing THEN
        userImpactScore = MapUserImpactToScore(userImpact.impactLevel)
        score += userImpactScore * weights.userImpact
    END IF

    // Component 7: SLO breaches (weight: 0.10)
    IF sloBreaches.Length > 0 THEN
        maxBreachSeverity = GetMaxBreachSeverity(sloBreaches)
        score += maxBreachSeverity * weights.sloBreaches
    END IF

    // Component 8: Critical service involvement (weight: 0.05)
    IF impactFactors.criticalServiceInvolved THEN
        score += 1.0 * weights.criticalService
    END IF

    // Adjustment based on historical severity
    IF historicalCorrelation.hasSimilarIncidents THEN
        historicalWeight = 0.3 * historicalCorrelation.confidence
        currentWeight = 1.0 - historicalWeight

        score = (score * currentWeight) +
                (historicalCorrelation.averageSeverity * historicalWeight)
    END IF

    // Ensure score is in valid range
    score = CLAMP(score, 0.0, 1.0)

    RETURN score
END PROCEDURE
```

### 2.7 Severity Level Determination

```pseudocode
PROCEDURE DetermineSeverityLevel(score: Float) -> String:
    // Map severity score to discrete severity level

    // Decision tree based on score thresholds
    IF score >= 0.85 THEN
        // P0: Critical - Complete service outage, major data loss
        RETURN "critical"

    ELSE IF score >= 0.70 THEN
        // P1: High - Significant degradation, user-facing issues
        RETURN "high"

    ELSE IF score >= 0.50 THEN
        // P2: Medium - Moderate impact, some users affected
        RETURN "medium"

    ELSE IF score >= 0.30 THEN
        // P3: Low - Minor impact, mostly internal
        RETURN "low"

    ELSE
        // P4: Informational - No significant impact
        RETURN "informational"
    END IF
END PROCEDURE
```

---

## 3. Automated Triage

### 3.1 Core Triage Algorithm

```pseudocode
PROCEDURE AutomatedTriage(
    agent: Agent,
    anomaly: CorrelatedAnomaly,
    severity: SeverityClassification
) -> TriageResult:
    // Automatically triage incident and prepare for response

    span = StartSpan(agent.telemetry, "automated_triage")

    TRY
        // Step 1: Categorize incident
        category = CategorizeIncident(agent, anomaly, severity)

        // Step 2: Identify affected services
        affectedServices = IdentifyAffectedServices(agent, anomaly)

        // Step 3: Generate root cause hypotheses
        hypotheses = GenerateRootCauseHypotheses(agent, anomaly, severity)

        // Step 4: Assign ownership
        ownership = AssignOwnership(agent, affectedServices, category)

        // Step 5: Select communication template
        communicationTemplate = SelectCommunicationTemplate(
            agent,
            severity,
            category
        )

        // Step 6: Manage priority queue
        priority = CalculateTriagePriority(severity, anomaly)

        // Step 7: Create triage result
        triage = NEW TriageResult(
            incidentId: GenerateIncidentID(),
            category: category,
            severity: severity,
            affectedServices: affectedServices,
            rootCauseHypotheses: hypotheses,
            ownership: ownership,
            communicationTemplate: communicationTemplate,
            priority: priority,
            triagedAt: CurrentTimestamp(),
            triagedBy: "automated"
        )

        // Step 8: Record metrics
        RecordMetric(agent.metrics, "triage.completed", 1, {
            category: category,
            severity: severity.level
        })

        RETURN triage

    FINALLY
        EndSpan(span)
    END TRY
END PROCEDURE
```

### 3.2 Incident Categorization

```pseudocode
PROCEDURE CategorizeIncident(
    agent: Agent,
    anomaly: CorrelatedAnomaly,
    severity: SeverityClassification
) -> IncidentCategory:
    // Categorize incident type for appropriate handling

    // Step 1: Extract features for classification
    features = ExtractCategoryFeatures(anomaly, severity)

    // Step 2: Check for known patterns first
    knownPattern = MatchKnownIncidentPatterns(agent, features)
    IF knownPattern != NULL THEN
        RETURN knownPattern.category
    END IF

    // Step 3: Use decision tree for classification
    category = ClassifyByDecisionTree(features)

    // Step 4: Validate with LLM if uncertain
    IF category.confidence < 0.7 THEN
        category = ClassifyWithLLM(agent, anomaly, features)
    END IF

    RETURN category
END PROCEDURE
```

```pseudocode
PROCEDURE ClassifyByDecisionTree(features: CategoryFeatures) -> IncidentCategory:
    // Decision tree for incident categorization

    // Branch 1: Availability issues
    IF features.availabilityImpact > 0.8 THEN
        IF features.errorRate > 0.5 THEN
            RETURN NEW IncidentCategory(
                type: "outage",
                subtype: "complete_failure",
                confidence: 0.9
            )
        ELSE
            RETURN NEW IncidentCategory(
                type: "outage",
                subtype: "partial_failure",
                confidence: 0.85
            )
        END IF
    END IF

    // Branch 2: Performance degradation
    IF features.latencyIncrease > 2.0 THEN
        IF features.hasResourceContention THEN
            RETURN NEW IncidentCategory(
                type: "performance",
                subtype: "resource_contention",
                confidence: 0.8
            )
        ELSE IF features.hasDependencyIssue THEN
            RETURN NEW IncidentCategory(
                type: "performance",
                subtype: "dependency_latency",
                confidence: 0.8
            )
        ELSE
            RETURN NEW IncidentCategory(
                type: "performance",
                subtype: "slow_response",
                confidence: 0.75
            )
        END IF
    END IF

    // Branch 3: Error rate spike
    IF features.errorRateIncrease > 3.0 THEN
        IF features.hasCodeDeployment THEN
            RETURN NEW IncidentCategory(
                type: "deployment",
                subtype: "bad_release",
                confidence: 0.85
            )
        ELSE IF features.hasConfigChange THEN
            RETURN NEW IncidentCategory(
                type: "configuration",
                subtype: "bad_config",
                confidence: 0.8
            )
        ELSE
            RETURN NEW IncidentCategory(
                type: "errors",
                subtype: "exception_spike",
                confidence: 0.7
            )
        END IF
    END IF

    // Branch 4: Resource exhaustion
    IF features.hasResourceExhaustion THEN
        SWITCH features.exhaustedResource:
            CASE "memory":
                RETURN NEW IncidentCategory(
                    type: "resource",
                    subtype: "memory_leak",
                    confidence: 0.8
                )
            CASE "disk":
                RETURN NEW IncidentCategory(
                    type: "resource",
                    subtype: "disk_full",
                    confidence: 0.9
                )
            CASE "connections":
                RETURN NEW IncidentCategory(
                    type: "resource",
                    subtype: "connection_pool_exhaustion",
                    confidence: 0.85
                )
        END SWITCH
    END IF

    // Branch 5: Dependency failure
    IF features.hasDependencyFailure THEN
        RETURN NEW IncidentCategory(
            type: "dependency",
            subtype: "external_service_failure",
            confidence: 0.8
        )
    END IF

    // Branch 6: Security incident
    IF features.hasSecurityIndicators THEN
        RETURN NEW IncidentCategory(
            type: "security",
            subtype: "potential_breach",
            confidence: 0.75
        )
    END IF

    // Default: Unknown
    RETURN NEW IncidentCategory(
        type: "unknown",
        subtype: "investigation_required",
        confidence: 0.5
    )
END PROCEDURE
```

### 3.3 Root Cause Hypothesis Generation

```pseudocode
PROCEDURE GenerateRootCauseHypotheses(
    agent: Agent,
    anomaly: CorrelatedAnomaly,
    severity: SeverityClassification
) -> List<RootCauseHypothesis>:
    // Generate ranked hypotheses for root cause

    hypotheses = []

    // Step 1: Check recent changes
    recentChanges = GetRecentChanges(agent, anomaly.services, anomaly.timeWindow)

    FOR EACH change IN recentChanges DO
        IF IsLikelyRootCause(change, anomaly) THEN
            hypothesis = NEW RootCauseHypothesis(
                type: "change_related",
                description: "Incident may be caused by " + change.type,
                change: change,
                confidence: CalculateChangeCorrelation(change, anomaly),
                priority: 1
            )
            hypotheses.Append(hypothesis)
        END IF
    END FOR

    // Step 2: Analyze error patterns
    errorPatterns = AnalyzeErrorPatterns(agent, anomaly)
    FOR EACH pattern IN errorPatterns DO
        hypothesis = NEW RootCauseHypothesis(
            type: "error_pattern",
            description: pattern.description,
            evidence: pattern.evidence,
            confidence: pattern.confidence,
            priority: 2
        )
        hypotheses.Append(hypothesis)
    END FOR

    // Step 3: Check resource constraints
    resourceIssues = CheckResourceConstraints(agent, anomaly.services)
    FOR EACH issue IN resourceIssues DO
        hypothesis = NEW RootCauseHypothesis(
            type: "resource_constraint",
            description: "Resource exhaustion: " + issue.resource,
            evidence: issue,
            confidence: issue.severity,
            priority: 2
        )
        hypotheses.Append(hypothesis)
    END FOR

    // Step 4: Analyze dependency failures
    dependencyFailures = AnalyzeDependencyFailures(agent, anomaly)
    FOR EACH failure IN dependencyFailures DO
        hypothesis = NEW RootCauseHypothesis(
            type: "dependency_failure",
            description: "Dependency failure: " + failure.dependency,
            evidence: failure,
            confidence: failure.correlation,
            priority: 1
        )
        hypotheses.Append(hypothesis)
    END FOR

    // Step 5: Check historical patterns
    historicalMatches = FindHistoricalRootCauses(agent, anomaly)
    FOR EACH match IN historicalMatches DO
        hypothesis = NEW RootCauseHypothesis(
            type: "historical_pattern",
            description: "Similar to incident " + match.incidentId,
            evidence: match,
            confidence: match.similarity * 0.8,
            priority: 3
        )
        hypotheses.Append(hypothesis)
    END FOR

    // Step 6: Use LLM for complex analysis
    IF hypotheses.Length == 0 OR GetMaxConfidence(hypotheses) < 0.6 THEN
        llmHypothesis = GenerateLLMHypothesis(agent, anomaly, severity)
        IF llmHypothesis != NULL THEN
            hypotheses.Append(llmHypothesis)
        END IF
    END IF

    // Step 7: Rank hypotheses
    SortByPriorityAndConfidence(hypotheses)

    // Return top hypotheses
    RETURN hypotheses.GetTop(5)
END PROCEDURE
```

### 3.4 Ownership Assignment

```pseudocode
PROCEDURE AssignOwnership(
    agent: Agent,
    affectedServices: List<Service>,
    category: IncidentCategory
) -> OwnershipAssignment:
    // Assign ownership to appropriate team/individual

    // Step 1: Identify primary affected service
    primaryService = DeterminePrimaryService(affectedServices)

    // Step 2: Get service ownership information
    serviceOwnership = GetServiceOwnership(agent.storage.db, primaryService)

    IF serviceOwnership == NULL THEN
        // Fallback to category-based assignment
        RETURN AssignByCategoryFallback(agent, category)
    END IF

    // Step 3: Determine on-call engineer
    onCallEngineer = GetOnCallEngineer(
        agent,
        serviceOwnership.team,
        CurrentTimestamp()
    )

    // Step 4: Identify backup contacts
    backupContacts = GetBackupContacts(agent, serviceOwnership.team)

    // Step 5: Get escalation chain
    escalationChain = GetEscalationChain(agent, serviceOwnership.team)

    // Step 6: Create ownership assignment
    ownership = NEW OwnershipAssignment(
        primaryOwner: onCallEngineer,
        owningTeam: serviceOwnership.team,
        backupContacts: backupContacts,
        escalationChain: escalationChain,
        assignedAt: CurrentTimestamp(),
        notificationStatus: "pending"
    )

    RETURN ownership
END PROCEDURE
```

### 3.5 Communication Template Selection

```pseudocode
PROCEDURE SelectCommunicationTemplate(
    agent: Agent,
    severity: SeverityClassification,
    category: IncidentCategory
) -> CommunicationTemplate:
    // Select appropriate communication template

    // Step 1: Load templates
    templates = LoadCommunicationTemplates(agent.storage.db)

    // Step 2: Filter by severity and category
    matchingTemplates = FilterTemplates(templates, severity.level, category.type)

    IF matchingTemplates.Length == 0 THEN
        // Use default template
        RETURN GetDefaultTemplate(agent, severity.level)
    END IF

    // Step 3: Select best matching template
    bestTemplate = SelectBestTemplate(matchingTemplates, severity, category)

    // Step 4: Customize template with dynamic fields
    customizedTemplate = CustomizeTemplate(bestTemplate, {
        severity: severity.level,
        category: category.type,
        services: affectedServices,
        timestamp: CurrentTimestamp()
    })

    RETURN customizedTemplate
END PROCEDURE
```

### 3.6 Priority Queue Management

```pseudocode
PROCEDURE CalculateTriagePriority(
    severity: SeverityClassification,
    anomaly: CorrelatedAnomaly
) -> Integer:
    // Calculate numeric priority for incident queue

    priority = 0

    // Base priority from severity
    SWITCH severity.level:
        CASE "critical":
            priority = 100
        CASE "high":
            priority = 75
        CASE "medium":
            priority = 50
        CASE "low":
            priority = 25
        DEFAULT:
            priority = 10
    END SWITCH

    // Adjust for user impact
    IF anomaly.userImpact.isUserFacing THEN
        priority += 20
    END IF

    // Adjust for SLO breaches
    IF anomaly.sloBreaches.Length > 0 THEN
        priority += 15
    END IF

    // Adjust for blast radius
    blastRadiusBonus = MIN(anomaly.blastRadius * 2, 20)
    priority += blastRadiusBonus

    // Adjust for trend (getting worse)
    IF IsGettingWorse(anomaly) THEN
        priority += 10
    END IF

    RETURN priority
END PROCEDURE
```

---

## 4. Response Coordinator

### 4.1 Core Response Coordination

```pseudocode
PROCEDURE CoordinateResponse(
    agent: Agent,
    incident: Incident,
    triage: TriageResult
) -> ResponseExecution:
    // Coordinate incident response workflow

    span = StartSpan(agent.telemetry, "response_coordination")

    TRY
        // Step 1: Select appropriate runbook
        runbook = SelectRunbook(agent, incident, triage)

        // Step 2: Initialize response context
        responseContext = InitializeResponseContext(agent, incident, triage)

        // Step 3: Manage approval workflow if needed
        IF runbook.requiresApproval THEN
            approval = ManageApprovalWorkflow(agent, incident, runbook)
            IF NOT approval.approved THEN
                RETURN CreateResponseExecution(
                    status: "pending_approval",
                    incident: incident,
                    runbook: runbook
                )
            END IF
        END IF

        // Step 4: Execute runbook actions
        execution = ExecuteRunbook(agent, incident, runbook, responseContext)

        // Step 5: Monitor execution and handle failures
        MonitorExecution(agent, execution)

        // Step 6: Decide on rollback if needed
        IF execution.status == "failed" AND runbook.hasRollback THEN
            rollback = ManageRollbackDecision(agent, incident, execution)
            IF rollback.shouldRollback THEN
                ExecuteRollback(agent, incident, rollback)
            END IF
        END IF

        // Step 7: Broadcast status updates
        BroadcastStatusUpdate(agent, incident, execution)

        // Step 8: Construct incident timeline
        timeline = ConstructIncidentTimeline(agent, incident, execution)

        // Step 9: Record metrics
        RecordMetric(agent.metrics, "response.coordinated", 1, {
            status: execution.status,
            duration: execution.duration
        })

        RETURN execution

    FINALLY
        EndSpan(span)
    END TRY
END PROCEDURE
```

### 4.2 Runbook Selection Algorithm

```pseudocode
PROCEDURE SelectRunbook(
    agent: Agent,
    incident: Incident,
    triage: TriageResult
) -> Runbook:
    // Select most appropriate runbook for incident

    // Step 1: Load available runbooks
    allRunbooks = LoadRunbooks(agent.storage.db)

    // Step 2: Filter by incident category
    categoryMatches = FilterByCategory(allRunbooks, triage.category)

    IF categoryMatches.Length == 0 THEN
        // No category match, try broader search
        categoryMatches = FilterBySeverity(allRunbooks, triage.severity.level)
    END IF

    IF categoryMatches.Length == 0 THEN
        // Use generic investigation runbook
        RETURN GetGenericRunbook(agent, triage.severity.level)
    END IF

    // Step 3: Score runbooks by relevance
    scoredRunbooks = []

    FOR EACH runbook IN categoryMatches DO
        score = 0.0

        // Score by service match
        serviceMatch = CalculateServiceMatch(
            runbook.applicableServices,
            incident.affectedServices
        )
        score += serviceMatch * 0.3

        // Score by symptom match
        symptomMatch = CalculateSymptomMatch(
            runbook.symptoms,
            incident.anomaly
        )
        score += symptomMatch * 0.3

        // Score by historical success
        successRate = GetRunbookSuccessRate(agent.storage.db, runbook.id)
        score += successRate * 0.2

        // Score by recent usage
        recencyScore = CalculateRecencyScore(runbook.lastUsed)
        score += recencyScore * 0.1

        // Score by confidence from root cause hypotheses
        hypothesisMatch = CalculateHypothesisMatch(
            runbook,
            triage.rootCauseHypotheses
        )
        score += hypothesisMatch * 0.1

        scoredRunbooks.Append({
            runbook: runbook,
            score: score
        })
    END FOR

    // Step 4: Sort by score
    SortByScoreDescending(scoredRunbooks)

    // Step 5: Return best match
    bestMatch = scoredRunbooks[0]

    // Step 6: Log selection
    LogAuditEvent(agent.audit, "runbook_selected", {
        incidentId: incident.id,
        runbookId: bestMatch.runbook.id,
        score: bestMatch.score
    })

    RETURN bestMatch.runbook
END PROCEDURE
```

### 4.3 Approval Workflow Management

```pseudocode
PROCEDURE ManageApprovalWorkflow(
    agent: Agent,
    incident: Incident,
    runbook: Runbook
) -> ApprovalResult:
    // Manage approval workflow for potentially destructive actions

    // Step 1: Determine required approvers
    approvers = DetermineApprovers(agent, incident, runbook)

    // Step 2: Create approval request
    approvalRequest = NEW ApprovalRequest(
        id: GenerateApprovalID(),
        incidentId: incident.id,
        runbookId: runbook.id,
        requiredApprovers: approvers,
        requestedAt: CurrentTimestamp(),
        timeout: runbook.approvalTimeout || 300,  // 5 minutes default
        status: "pending"
    )

    // Step 3: Send approval notifications
    FOR EACH approver IN approvers DO
        SendApprovalNotification(agent, approver, approvalRequest, incident)
    END FOR

    // Step 4: Wait for approvals with timeout
    startTime = CurrentTimestamp()
    approvals = []

    WHILE CurrentTimestamp() - startTime < approvalRequest.timeout DO
        // Check for new approvals
        newApprovals = CheckForApprovals(agent, approvalRequest.id)
        approvals.AddAll(newApprovals)

        // Check if all required approvals received
        IF HasAllApprovals(approvals, approvers) THEN
            approvalRequest.status = "approved"
            approvalRequest.approvedAt = CurrentTimestamp()

            RETURN NEW ApprovalResult(
                approved: true,
                approvers: approvals,
                approvedAt: CurrentTimestamp()
            )
        END IF

        // Check for rejections
        IF HasAnyRejection(approvals) THEN
            approvalRequest.status = "rejected"

            RETURN NEW ApprovalResult(
                approved: false,
                reason: "Approval rejected by " + GetRejecter(approvals).name
            )
        END IF

        Sleep(1000)  // Check every second
    END WHILE

    // Timeout occurred
    approvalRequest.status = "timeout"

    // Handle timeout based on policy
    IF runbook.approvalTimeoutPolicy == "auto_approve" THEN
        LogWarning(agent.audit, "approval_timeout_auto_approved", {
            incidentId: incident.id
        })

        RETURN NEW ApprovalResult(
            approved: true,
            autoApproved: true,
            reason: "Approval timeout - auto-approved per policy"
        )
    ELSE
        RETURN NEW ApprovalResult(
            approved: false,
            reason: "Approval timeout"
        )
    END IF
END PROCEDURE
```

### 4.4 Runbook Execution

```pseudocode
PROCEDURE ExecuteRunbook(
    agent: Agent,
    incident: Incident,
    runbook: Runbook,
    context: ResponseContext
) -> ExecutionResult:
    // Execute runbook actions with proper orchestration

    execution = NEW ExecutionResult(
        id: GenerateExecutionID(),
        incidentId: incident.id,
        runbookId: runbook.id,
        startedAt: CurrentTimestamp(),
        status: "running",
        steps: []
    )

    TRY
        // Step 1: Parse runbook execution plan
        executionPlan = ParseExecutionPlan(runbook, context)

        // Step 2: Execute actions based on plan
        FOR EACH action IN executionPlan.actions DO
            // Check if should continue after previous failures
            IF execution.status == "failed" AND NOT action.continueOnFailure THEN
                BREAK
            END IF

            // Create step record
            step = NEW ExecutionStep(
                id: GenerateStepID(),
                action: action,
                startedAt: CurrentTimestamp(),
                status: "running"
            )

            execution.steps.Append(step)

            // Broadcast status
            BroadcastStatusUpdate(agent, incident, {
                type: "step_started",
                step: step
            })

            // Execute action
            TRY
                result = ExecuteAction(agent, action, context)

                step.completedAt = CurrentTimestamp()
                step.status = "success"
                step.result = result

                // Update context with result
                context.Update(action.outputKey, result)

            CATCH error AS Exception:
                step.completedAt = CurrentTimestamp()
                step.status = "failed"
                step.error = error

                LogError(agent.audit, error, "runbook_step_failed", {
                    incidentId: incident.id,
                    stepId: step.id
                })

                // Handle failure
                IF action.onFailure != NULL THEN
                    ExecuteFailureHandler(agent, action.onFailure, context)
                END IF

                IF NOT action.continueOnFailure THEN
                    execution.status = "failed"
                    BREAK
                END IF
            END TRY

            // Broadcast step completion
            BroadcastStatusUpdate(agent, incident, {
                type: "step_completed",
                step: step
            })
        END FOR

        // Step 3: Determine final status
        IF execution.status != "failed" THEN
            execution.status = "completed"
        END IF

        execution.completedAt = CurrentTimestamp()
        execution.duration = execution.completedAt - execution.startedAt

        // Step 4: Store execution result
        StoreExecutionResult(agent.storage.db, execution)

        RETURN execution

    CATCH error AS Exception:
        execution.status = "failed"
        execution.error = error
        execution.completedAt = CurrentTimestamp()

        LogError(agent.audit, error, "runbook_execution_failed", {
            incidentId: incident.id
        })

        RETURN execution
    END TRY
END PROCEDURE
```

### 4.5 Parallel vs Sequential Execution

```pseudocode
PROCEDURE ParseExecutionPlan(
    runbook: Runbook,
    context: ResponseContext
) -> ExecutionPlan:
    // Parse runbook into optimized execution plan

    plan = NEW ExecutionPlan()

    // Step 1: Build dependency graph
    dependencyGraph = BuildDependencyGraph(runbook.actions)

    // Step 2: Identify parallelizable actions
    parallelGroups = IdentifyParallelGroups(dependencyGraph)

    // Step 3: Create execution stages
    FOR EACH group IN parallelGroups DO
        IF group.actions.Length == 1 THEN
            // Sequential action
            plan.AddSequentialStage(group.actions[0])
        ELSE
            // Parallel actions
            plan.AddParallelStage(group.actions)
        END IF
    END FOR

    // Step 4: Validate plan
    ValidateExecutionPlan(plan, runbook)

    RETURN plan
END PROCEDURE
```

```pseudocode
PROCEDURE ExecuteAction(
    agent: Agent,
    action: RunbookAction,
    context: ResponseContext
) -> ActionResult:
    // Execute a single runbook action

    // Resolve parameters from context
    parameters = ResolveParameters(action.parameters, context)

    // Execute based on action type
    SWITCH action.type:
        CASE "api_call":
            RETURN ExecuteAPICall(agent, action, parameters)

        CASE "script":
            RETURN ExecuteScript(agent, action, parameters)

        CASE "orchestrator_workflow":
            RETURN ExecuteOrchestrator Workflow(agent, action, parameters)

        CASE "manual_step":
            RETURN WaitForManualCompletion(agent, action, parameters)

        CASE "notification":
            RETURN SendNotification(agent, action, parameters)

        CASE "metric_check":
            RETURN CheckMetric(agent, action, parameters)

        CASE "rollback":
            RETURN ExecuteRollback(agent, action, parameters)

        DEFAULT:
            THROW UnsupportedActionError("Unknown action type: " + action.type)
    END SWITCH
END PROCEDURE
```

### 4.6 Rollback Decision Logic

```pseudocode
PROCEDURE ManageRollbackDecision(
    agent: Agent,
    incident: Incident,
    execution: ExecutionResult
) -> RollbackDecision:
    // Decide whether to rollback based on execution results

    // Step 1: Analyze execution failure
    failureAnalysis = AnalyzeExecutionFailure(execution)

    // Step 2: Check if situation worsened
    currentState = GetCurrentSystemState(agent, incident.affectedServices)
    previousState = GetSystemStateAtTime(agent, incident.affectedServices, incident.detectedAt)

    isWorse = CompareSystemStates(currentState, previousState) == "worse"

    // Step 3: Calculate rollback confidence
    rollbackConfidence = 0.0

    IF failureAnalysis.causedByAction THEN
        rollbackConfidence += 0.5
    END IF

    IF isWorse THEN
        rollbackConfidence += 0.3
    END IF

    IF incident.hasRecentDeployment THEN
        rollbackConfidence += 0.2
    END IF

    // Step 4: Decide on rollback
    shouldRollback = false
    reason = ""

    IF rollbackConfidence > 0.7 THEN
        shouldRollback = true
        reason = "High confidence that rollback will improve situation"
    ELSE IF incident.severity.level == "critical" AND rollbackConfidence > 0.5 THEN
        shouldRollback = true
        reason = "Critical incident with moderate rollback confidence"
    ELSE IF isWorse AND incident.hasRecentDeployment THEN
        shouldRollback = true
        reason = "Situation worsened after recent deployment"
    ELSE
        shouldRollback = false
        reason = "Insufficient confidence in rollback effectiveness"
    END IF

    // Step 5: Check for manual override
    IF agent.config.requireManualRollbackApproval THEN
        approval = RequestRollbackApproval(agent, incident, shouldRollback, reason)
        shouldRollback = approval.approved
    END IF

    // Step 6: Create decision
    decision = NEW RollbackDecision(
        shouldRollback: shouldRollback,
        confidence: rollbackConfidence,
        reason: reason,
        decidedAt: CurrentTimestamp()
    )

    RETURN decision
END PROCEDURE
```

### 4.7 Status Broadcasting

```pseudocode
PROCEDURE BroadcastStatusUpdate(
    agent: Agent,
    incident: Incident,
    update: StatusUpdate
) -> void:
    // Broadcast incident status to all stakeholders

    // Step 1: Prepare update message
    message = FormatStatusUpdate(incident, update)

    // Step 2: Determine recipients
    recipients = GetStatusUpdateRecipients(agent, incident)

    // Step 3: Send to notification channels
    FOR EACH channel IN agent.config.notificationChannels DO
        TRY
            SWITCH channel.type:
                CASE "slack":
                    SendSlackMessage(channel, incident.slackChannelId, message)

                CASE "email":
                    SendEmailUpdate(channel, recipients, message)

                CASE "pagerduty":
                    UpdatePagerDutyIncident(channel, incident.pagerDutyId, message)

                CASE "webhook":
                    SendWebhook(channel, incident, update)

                CASE "sms":
                    SendSMSAlert(channel, recipients, message)
            END SWITCH

        CATCH error AS Exception:
            LogError(agent.audit, error, "notification_failed", {
                channel: channel.type,
                incidentId: incident.id
            })
        END TRY
    END FOR

    // Step 4: Update incident timeline
    AddToTimeline(agent, incident, update)

    // Step 5: Record metric
    RecordMetric(agent.metrics, "status.broadcast", 1, {
        incidentId: incident.id,
        updateType: update.type
    })
END PROCEDURE
```

### 4.8 Incident Timeline Construction

```pseudocode
PROCEDURE ConstructIncidentTimeline(
    agent: Agent,
    incident: Incident,
    execution: ExecutionResult
) -> Timeline:
    // Construct comprehensive incident timeline

    timeline = NEW Timeline(
        incidentId: incident.id,
        events: []
    )

    // Step 1: Add detection event
    timeline.AddEvent(NEW TimelineEvent(
        timestamp: incident.detectedAt,
        type: "detection",
        description: "Incident detected",
        details: incident.anomaly,
        source: "anomaly_detector"
    ))

    // Step 2: Add triage event
    timeline.AddEvent(NEW TimelineEvent(
        timestamp: incident.triagedAt,
        type: "triage",
        description: "Incident triaged",
        details: incident.triage,
        source: "automated_triage"
    ))

    // Step 3: Add ownership assignment
    timeline.AddEvent(NEW TimelineEvent(
        timestamp: incident.triage.ownership.assignedAt,
        type: "assignment",
        description: "Assigned to " + incident.triage.ownership.primaryOwner.name,
        details: incident.triage.ownership,
        source: "automated_triage"
    ))

    // Step 4: Add response execution events
    FOR EACH step IN execution.steps DO
        timeline.AddEvent(NEW TimelineEvent(
            timestamp: step.startedAt,
            type: "action",
            description: "Started: " + step.action.name,
            details: step,
            source: "response_coordinator"
        ))

        timeline.AddEvent(NEW TimelineEvent(
            timestamp: step.completedAt,
            type: "action_result",
            description: "Completed: " + step.action.name + " (" + step.status + ")",
            details: step,
            source: "response_coordinator"
        ))
    END FOR

    // Step 5: Add status updates
    statusUpdates = GetStatusUpdates(agent, incident)
    FOR EACH update IN statusUpdates DO
        timeline.AddEvent(NEW TimelineEvent(
            timestamp: update.timestamp,
            type: "status_update",
            description: update.message,
            details: update,
            source: "response_coordinator"
        ))
    END FOR

    // Step 6: Add resolution or escalation
    IF incident.status == "resolved" THEN
        timeline.AddEvent(NEW TimelineEvent(
            timestamp: incident.resolvedAt,
            type: "resolution",
            description: "Incident resolved",
            details: incident.resolution,
            source: "response_coordinator"
        ))
    ELSE IF incident.status == "escalated" THEN
        timeline.AddEvent(NEW TimelineEvent(
            timestamp: incident.escalatedAt,
            type: "escalation",
            description: "Incident escalated",
            details: incident.escalation,
            source: "response_coordinator"
        ))
    END IF

    // Step 7: Sort events chronologically
    SortByTimestamp(timeline.events)

    // Step 8: Store timeline
    StoreTimeline(agent.storage.db, timeline)

    RETURN timeline
END PROCEDURE
```

---

## 5. Post-Incident Analyzer

### 5.1 Core Post-Incident Analysis

```pseudocode
PROCEDURE AnalyzePostIncident(
    agent: Agent,
    incident: Incident
) -> PostIncidentAnalysis:
    // Comprehensive post-incident analysis

    span = StartSpan(agent.telemetry, "post_incident_analysis")

    TRY
        // Step 1: Reconstruct timeline
        timeline = ReconstructTimeline(agent, incident)

        // Step 2: Perform root cause analysis
        rootCause = PerformRootCauseAnalysis(agent, incident, timeline)

        // Step 3: Identify contributing factors
        contributingFactors = IdentifyContributingFactors(agent, incident, timeline)

        // Step 4: Generate recommendations
        recommendations = GenerateRecommendations(agent, incident, rootCause, contributingFactors)

        // Step 5: Find similar incidents
        similarIncidents = FindSimilarIncidents(agent, incident)

        // Step 6: Extract learnings
        learnings = ExtractLearnings(agent, incident, rootCause, contributingFactors)

        // Step 7: Create analysis report
        analysis = NEW PostIncidentAnalysis(
            incidentId: incident.id,
            timeline: timeline,
            rootCause: rootCause,
            contributingFactors: contributingFactors,
            recommendations: recommendations,
            similarIncidents: similarIncidents,
            learnings: learnings,
            analyzedAt: CurrentTimestamp(),
            analyzer: "automated"
        )

        // Step 8: Store analysis
        StorePostIncidentAnalysis(agent.storage.db, analysis)

        // Step 9: Update knowledge base
        UpdateKnowledgeBase(agent, analysis)

        // Step 10: Record metrics
        RecordMetric(agent.metrics, "post_incident.analyzed", 1, {
            incidentId: incident.id,
            severity: incident.severity.level
        })

        RETURN analysis

    FINALLY
        EndSpan(span)
    END TRY
END PROCEDURE
```

### 5.2 Timeline Reconstruction

```pseudocode
PROCEDURE ReconstructTimeline(
    agent: Agent,
    incident: Incident
) -> DetailedTimeline:
    // Reconstruct detailed incident timeline with all signals

    // Step 1: Load base timeline
    baseTimeline = LoadTimeline(agent.storage.db, incident.id)

    // Step 2: Enhance with metric data
    metricEvents = ReconstructMetricTimeline(
        agent,
        incident.affectedServices,
        incident.detectedAt,
        incident.resolvedAt
    )

    // Step 3: Enhance with log data
    logEvents = ReconstructLogTimeline(
        agent,
        incident.affectedServices,
        incident.detectedAt,
        incident.resolvedAt
    )

    // Step 4: Enhance with trace data
    traceEvents = ReconstructTraceTimeline(
        agent,
        incident.affectedServices,
        incident.detectedAt,
        incident.resolvedAt
    )

    // Step 5: Add deployment events
    deploymentEvents = GetDeploymentEvents(
        agent,
        incident.affectedServices,
        incident.detectedAt - 3600,  // 1 hour before
        incident.resolvedAt
    )

    // Step 6: Add configuration changes
    configEvents = GetConfigurationChanges(
        agent,
        incident.affectedServices,
        incident.detectedAt - 3600,
        incident.resolvedAt
    )

    // Step 7: Merge all events
    allEvents = baseTimeline.events +
                metricEvents +
                logEvents +
                traceEvents +
                deploymentEvents +
                configEvents

    // Step 8: Sort chronologically
    SortByTimestamp(allEvents)

    // Step 9: Identify key moments
    keyMoments = IdentifyKeyMoments(allEvents)

    // Step 10: Create detailed timeline
    detailedTimeline = NEW DetailedTimeline(
        incidentId: incident.id,
        events: allEvents,
        keyMoments: keyMoments,
        duration: incident.resolvedAt - incident.detectedAt,
        reconstructedAt: CurrentTimestamp()
    )

    RETURN detailedTimeline
END PROCEDURE
```

### 5.3 Root Cause Analysis Algorithm

```pseudocode
PROCEDURE PerformRootCauseAnalysis(
    agent: Agent,
    incident: Incident,
    timeline: DetailedTimeline
) -> RootCauseAnalysis:
    // Determine root cause using multiple analysis methods

    // Step 1: Analyze timeline for causal relationships
    causalChain = AnalyzeCausalChain(timeline)

    // Step 2: Apply 5 Whys technique
    fiveWhys = ApplyFiveWhys(agent, incident, timeline)

    // Step 3: Perform fault tree analysis
    faultTree = BuildFaultTree(incident, timeline)

    // Step 4: Identify trigger event
    triggerEvent = IdentifyTriggerEvent(timeline, causalChain)

    // Step 5: Validate with evidence
    evidence = CollectRootCauseEvidence(agent, incident, triggerEvent)

    // Step 6: Calculate confidence
    confidence = CalculateRootCauseConfidence(
        causalChain,
        fiveWhys,
        faultTree,
        evidence
    )

    // Step 7: Use LLM for complex analysis
    llmAnalysis = NULL
    IF confidence < 0.7 THEN
        llmAnalysis = PerformLLMRootCauseAnalysis(agent, incident, timeline)

        IF llmAnalysis.confidence > confidence THEN
            // Use LLM analysis if more confident
            RETURN llmAnalysis
        END IF
    END IF

    // Step 8: Create root cause analysis
    analysis = NEW RootCauseAnalysis(
        incidentId: incident.id,
        rootCause: triggerEvent,
        causalChain: causalChain,
        fiveWhys: fiveWhys,
        faultTree: faultTree,
        evidence: evidence,
        confidence: confidence,
        llmAnalysis: llmAnalysis,
        analyzedAt: CurrentTimestamp()
    )

    RETURN analysis
END PROCEDURE
```

### 5.4 Contributing Factor Identification

```pseudocode
PROCEDURE IdentifyContributingFactors(
    agent: Agent,
    incident: Incident,
    timeline: DetailedTimeline
) -> List<ContributingFactor>:
    // Identify all factors that contributed to incident

    factors = []

    // Factor 1: Recent changes
    recentChanges = GetRecentChanges(agent, incident.affectedServices, timeline)
    FOR EACH change IN recentChanges DO
        IF DidContributeToIncident(change, incident, timeline) THEN
            factors.Append(NEW ContributingFactor(
                type: "change",
                description: "Recent " + change.type + " on " + change.service,
                impact: CalculateChangeImpact(change, incident),
                evidence: change,
                likelihood: 0.8
            ))
        END IF
    END FOR

    // Factor 2: System design weaknesses
    designWeaknesses = IdentifyDesignWeaknesses(agent, incident)
    FOR EACH weakness IN designWeaknesses DO
        factors.Append(NEW ContributingFactor(
            type: "design",
            description: weakness.description,
            impact: weakness.severity,
            evidence: weakness.evidence,
            likelihood: weakness.confidence
        ))
    END FOR

    // Factor 3: Resource constraints
    resourceIssues = AnalyzeResourceConstraints(agent, incident, timeline)
    FOR EACH issue IN resourceIssues DO
        factors.Append(NEW ContributingFactor(
            type: "resource",
            description: "Resource constraint: " + issue.resource,
            impact: issue.severity,
            evidence: issue.metrics,
            likelihood: 0.9
        ))
    END FOR

    // Factor 4: External dependencies
    dependencyIssues = AnalyzeDependencyIssues(agent, incident, timeline)
    FOR EACH issue IN dependencyIssues DO
        factors.Append(NEW ContributingFactor(
            type: "dependency",
            description: "Dependency issue: " + issue.dependency,
            impact: issue.impactScore,
            evidence: issue.failureData,
            likelihood: 0.7
        ))
    END FOR

    // Factor 5: Process failures
    processFailures = IdentifyProcessFailures(agent, incident)
    FOR EACH failure IN processFailures DO
        factors.Append(NEW ContributingFactor(
            type: "process",
            description: failure.description,
            impact: failure.severity,
            evidence: failure.details,
            likelihood: 0.6
        ))
    END FOR

    // Factor 6: Human factors
    humanFactors = IdentifyHumanFactors(agent, incident, timeline)
    FOR EACH factor IN humanFactors DO
        factors.Append(factor)
    END FOR

    // Sort by impact
    SortByImpactDescending(factors)

    RETURN factors
END PROCEDURE
```

### 5.5 Recommendation Generation

```pseudocode
PROCEDURE GenerateRecommendations(
    agent: Agent,
    incident: Incident,
    rootCause: RootCauseAnalysis,
    contributingFactors: List<ContributingFactor>
) -> List<Recommendation>:
    // Generate actionable recommendations to prevent recurrence

    recommendations = []

    // Step 1: Recommendations for root cause
    rootCauseRecs = GenerateRootCauseRecommendations(rootCause)
    recommendations.AddAll(rootCauseRecs)

    // Step 2: Recommendations for each contributing factor
    FOR EACH factor IN contributingFactors DO
        factorRecs = GenerateFactorRecommendations(factor)
        recommendations.AddAll(factorRecs)
    END FOR

    // Step 3: Process improvements
    processRecs = GenerateProcessRecommendations(incident)
    recommendations.AddAll(processRecs)

    // Step 4: Monitoring improvements
    monitoringRecs = GenerateMonitoringRecommendations(agent, incident)
    recommendations.AddAll(monitoringRecs)

    // Step 5: Deduplicate and prioritize
    recommendations = DeduplicateRecommendations(recommendations)
    PrioritizeRecommendations(recommendations)

    // Step 6: Add implementation guidance
    FOR EACH rec IN recommendations DO
        rec.implementation = GenerateImplementationGuidance(agent, rec)
    END FOR

    RETURN recommendations
END PROCEDURE
```

```pseudocode
PROCEDURE GenerateRootCauseRecommendations(
    rootCause: RootCauseAnalysis
) -> List<Recommendation>:
    // Generate recommendations to address root cause

    recommendations = []

    SWITCH rootCause.rootCause.type:
        CASE "deployment":
            recommendations.Append(NEW Recommendation(
                category: "deployment",
                priority: "high",
                title: "Improve deployment safety",
                description: "Implement progressive delivery with automated rollback",
                actions: [
                    "Add canary deployment stage",
                    "Implement automated health checks",
                    "Configure automatic rollback on errors"
                ],
                estimatedEffort: "2-3 days",
                expectedImpact: "Prevent 70% of deployment-related incidents"
            ))

        CASE "configuration":
            recommendations.Append(NEW Recommendation(
                category: "configuration",
                priority: "high",
                title: "Enhance configuration management",
                description: "Add validation and gradual rollout for config changes",
                actions: [
                    "Implement config schema validation",
                    "Add staged config rollout",
                    "Create config change approval process"
                ],
                estimatedEffort: "1-2 days",
                expectedImpact: "Prevent 80% of configuration-related incidents"
            ))

        CASE "resource_exhaustion":
            recommendations.Append(NEW Recommendation(
                category: "capacity",
                priority: "high",
                title: "Implement auto-scaling",
                description: "Add automatic scaling to prevent resource exhaustion",
                actions: [
                    "Configure horizontal auto-scaling",
                    "Implement resource quotas",
                    "Add capacity alerts"
                ],
                estimatedEffort: "3-5 days",
                expectedImpact: "Eliminate resource exhaustion incidents"
            ))

        CASE "dependency_failure":
            recommendations.Append(NEW Recommendation(
                category: "resilience",
                priority: "high",
                title: "Improve dependency resilience",
                description: "Add circuit breakers and fallback mechanisms",
                actions: [
                    "Implement circuit breaker pattern",
                    "Add request timeouts and retries",
                    "Create fallback responses"
                ],
                estimatedEffort: "2-4 days",
                expectedImpact: "Reduce dependency-related incidents by 60%"
            ))
    END SWITCH

    RETURN recommendations
END PROCEDURE
```

### 5.6 Similar Incident Detection

```pseudocode
PROCEDURE FindSimilarIncidents(
    agent: Agent,
    incident: Incident
) -> List<SimilarIncident>:
    // Find similar historical incidents for learning

    // Step 1: Extract incident signature
    signature = ExtractIncidentSignature(incident)

    // Step 2: Search by vector similarity
    vectorResults = SearchByVectorSimilarity(
        agent.storage.db,
        signature.embedding,
        limit: 20
    )

    // Step 3: Search by categorical similarity
    categoricalResults = SearchByCategoryAndServices(
        agent.storage.db,
        incident.category,
        incident.affectedServices,
        limit: 20
    )

    // Step 4: Combine and score results
    allIncidents = CombineResults(vectorResults, categoricalResults)
    scoredIncidents = []

    FOR EACH candidate IN allIncidents DO
        score = CalculateIncidentSimilarity(incident, candidate)

        IF score > 0.5 THEN  // Similarity threshold
            scoredIncidents.Append({
                incident: candidate,
                similarity: score,
                commonFactors: IdentifyCommonFactors(incident, candidate)
            })
        END IF
    END FOR

    // Step 5: Sort by similarity
    SortByScoreDescending(scoredIncidents)

    // Step 6: Create similar incident records
    similarIncidents = []
    FOR EACH scored IN scoredIncidents.GetTop(10) DO
        similar = NEW SimilarIncident(
            incidentId: scored.incident.id,
            similarity: scored.similarity,
            commonFactors: scored.commonFactors,
            resolution: scored.incident.resolution,
            preventionMeasures: scored.incident.preventionMeasures,
            effectiveness: scored.incident.preventionEffectiveness
        )
        similarIncidents.Append(similar)
    END FOR

    RETURN similarIncidents
END PROCEDURE
```

### 5.7 Learning Extraction

```pseudocode
PROCEDURE ExtractLearnings(
    agent: Agent,
    incident: Incident,
    rootCause: RootCauseAnalysis,
    contributingFactors: List<ContributingFactor>
) -> IncidentLearnings:
    // Extract structured learnings from incident

    learnings = NEW IncidentLearnings()

    // Step 1: Technical learnings
    learnings.technical = []

    // From root cause
    learnings.technical.Append(NEW Learning(
        category: "root_cause",
        description: "Root cause: " + rootCause.rootCause.description,
        applicability: DetermineApplicability(rootCause.rootCause),
        preventionStrategy: ExtractPreventionStrategy(rootCause)
    ))

    // From contributing factors
    FOR EACH factor IN contributingFactors DO
        learnings.technical.Append(NEW Learning(
            category: "contributing_factor",
            description: factor.description,
            applicability: DetermineApplicability(factor),
            preventionStrategy: ExtractPreventionStrategy(factor)
        ))
    END FOR

    // Step 2: Process learnings
    learnings.process = AnalyzeProcessLearnings(incident)

    // Step 3: Detection improvements
    learnings.detection = []

    IF incident.detectionDelay > agent.config.targetDetectionTime THEN
        learnings.detection.Append(NEW Learning(
            category: "detection",
            description: "Detection took " + incident.detectionDelay + " seconds",
            improvement: "Add more sensitive alerts for this pattern",
            implementationPlan: GenerateDetectionImprovementPlan(incident)
        ))
    END IF

    // Step 4: Response improvements
    learnings.response = AnalyzeResponseLearnings(incident)

    // Step 5: Communication learnings
    learnings.communication = AnalyzeCommunicationLearnings(incident)

    // Step 6: Tool improvements
    learnings.tooling = IdentifyToolingGaps(incident)

    // Step 7: Training needs
    learnings.training = IdentifyTrainingNeeds(incident)

    // Step 8: Store learnings
    StoreLearnings(agent.storage.db, learnings)

    // Step 9: Update detection models
    UpdateDetectionModels(agent, learnings)

    // Step 10: Update runbooks
    UpdateRunbooks(agent, learnings)

    RETURN learnings
END PROCEDURE
```

---

## 6. Data Structures

### 6.1 Anomaly Data Structures

```pseudocode
DATA STRUCTURE Anomaly:
    id: String
    type: String                    // "metric", "log", "trace"
    detectionMethod: String         // "z-score", "iqr", "ml", etc.
    metricName: String
    service: String
    timestamp: Timestamp
    value: Float
    expectedValue: Float
    deviation: Float
    direction: String              // "spike", "drop"
    confidence: Float              // 0.0 to 1.0
    severity: Float               // 0.0 to 1.0
    metadata: Map
END DATA STRUCTURE

DATA STRUCTURE CorrelatedAnomaly:
    id: String
    primaryAnomaly: Anomaly
    relatedAnomalies: List<Anomaly>
    services: List<String>
    timeWindow: TimeRange
    correlationStrength: Float
    combinedSeverity: Float
    blastRadius: Integer
    confidence: Float
    linkedIncidentId: String       // If already exists
    metadata: Map
END DATA STRUCTURE

DATA STRUCTURE Baseline:
    metricName: String
    mean: Float
    median: Float
    stdDev: Float
    q1: Float
    q3: Float
    iqr: Float
    upperThreshold: Float
    lowerThreshold: Float
    trend: TrendComponent
    seasonal: SeasonalComponent
    seasonalityPeriod: Integer
    calculatedAt: Timestamp
    dataPoints: Integer
END DATA STRUCTURE
```

### 6.2 Incident Data Structures

```pseudocode
DATA STRUCTURE Incident:
    id: String
    anomaly: CorrelatedAnomaly
    severity: SeverityClassification
    triage: TriageResult
    status: String                 // "detected", "triaged", "responding", "resolved"
    affectedServices: List<String>
    detectedAt: Timestamp
    triagedAt: Timestamp
    respondedAt: Timestamp
    resolvedAt: Timestamp
    resolution: Resolution
    timeline: Timeline
    metadata: Map
END DATA STRUCTURE

DATA STRUCTURE SeverityClassification:
    level: String                  // "critical", "high", "medium", "low", "informational"
    score: Float                   // 0.0 to 1.0
    confidence: Float
    impactFactors: ImpactFactors
    userImpact: UserImpact
    sloBreaches: List<SLOBreach>
    escalationTriggers: List<EscalationTrigger>
    classifiedAt: Timestamp
    classifier: String             // "automated" or user ID
END DATA STRUCTURE

DATA STRUCTURE ImpactFactors:
    blastRadius: Integer
    blastRadiusScore: Float
    trafficImpact: Float
    errorRateIncrease: Float
    latencyDegradation: Float
    availabilityImpact: Float
    criticalServiceInvolved: Boolean
    affectedCustomers: Integer
    estimatedRevenueImpact: Float
    dataIntegrityRisk: Float
    securityRisk: Float
END DATA STRUCTURE

DATA STRUCTURE UserImpact:
    isUserFacing: Boolean
    impactLevel: String           // "critical", "major", "moderate", "minor", "internal"
    priority: String              // "high", "medium", "low"
    affectedJourneys: List<String>
    criticalJourneyAffected: Boolean
    uxDegradation: Float
    activeSessionsAffected: Integer
    isDuringBusinessHours: Boolean
    userComplaints: Integer
END DATA STRUCTURE

DATA STRUCTURE SLOBreach:
    service: String
    slo: SLODefinition
    sla: SLADefinition
    currentValue: Float
    targetValue: Float
    breachMagnitude: Float
    errorBudgetRemaining: Float
    timeToSLABreach: Integer       // seconds, NULL if SLA not breached
    breachedAt: Timestamp
    severity: Float
END DATA STRUCTURE
```

### 6.3 Triage Data Structures

```pseudocode
DATA STRUCTURE TriageResult:
    incidentId: String
    category: IncidentCategory
    severity: SeverityClassification
    affectedServices: List<ServiceInfo>
    rootCauseHypotheses: List<RootCauseHypothesis>
    ownership: OwnershipAssignment
    communicationTemplate: CommunicationTemplate
    priority: Integer
    triagedAt: Timestamp
    triagedBy: String
END DATA STRUCTURE

DATA STRUCTURE IncidentCategory:
    type: String                   // "outage", "performance", "errors", etc.
    subtype: String               // More specific classification
    confidence: Float
    metadata: Map
END DATA STRUCTURE

DATA STRUCTURE RootCauseHypothesis:
    type: String
    description: String
    evidence: Any
    confidence: Float
    priority: Integer             // 1 = highest
    suggestedActions: List<String>
END DATA STRUCTURE

DATA STRUCTURE OwnershipAssignment:
    primaryOwner: User
    owningTeam: Team
    backupContacts: List<User>
    escalationChain: List<EscalationLevel>
    assignedAt: Timestamp
    notificationStatus: String
END DATA STRUCTURE
```

### 6.4 Response Data Structures

```pseudocode
DATA STRUCTURE Runbook:
    id: String
    name: String
    description: String
    category: String
    applicableServices: List<String>
    symptoms: List<String>
    actions: List<RunbookAction>
    requiresApproval: Boolean
    approvalTimeout: Integer
    approvalTimeoutPolicy: String
    hasRollback: Boolean
    rollbackActions: List<RunbookAction>
    metadata: Map
END DATA STRUCTURE

DATA STRUCTURE RunbookAction:
    id: String
    name: String
    type: String                   // "api_call", "script", "workflow", etc.
    parameters: Map
    timeout: Integer
    continueOnFailure: Boolean
    onFailure: FailureHandler
    outputKey: String
    dependencies: List<String>     // Action IDs this depends on
    metadata: Map
END DATA STRUCTURE

DATA STRUCTURE ExecutionResult:
    id: String
    incidentId: String
    runbookId: String
    startedAt: Timestamp
    completedAt: Timestamp
    duration: Integer
    status: String                 // "running", "completed", "failed"
    steps: List<ExecutionStep>
    error: Exception
    metadata: Map
END DATA STRUCTURE

DATA STRUCTURE ExecutionStep:
    id: String
    action: RunbookAction
    startedAt: Timestamp
    completedAt: Timestamp
    status: String
    result: Any
    error: Exception
END DATA STRUCTURE

DATA STRUCTURE RollbackDecision:
    shouldRollback: Boolean
    confidence: Float
    reason: String
    decidedAt: Timestamp
    approvedBy: String
END DATA STRUCTURE
```

### 6.5 Post-Incident Data Structures

```pseudocode
DATA STRUCTURE PostIncidentAnalysis:
    incidentId: String
    timeline: DetailedTimeline
    rootCause: RootCauseAnalysis
    contributingFactors: List<ContributingFactor>
    recommendations: List<Recommendation>
    similarIncidents: List<SimilarIncident>
    learnings: IncidentLearnings
    analyzedAt: Timestamp
    analyzer: String
END DATA STRUCTURE

DATA STRUCTURE RootCauseAnalysis:
    incidentId: String
    rootCause: Event
    causalChain: List<CausalLink>
    fiveWhys: FiveWhysAnalysis
    faultTree: FaultTree
    evidence: List<Evidence>
    confidence: Float
    llmAnalysis: LLMAnalysis
    analyzedAt: Timestamp
END DATA STRUCTURE

DATA STRUCTURE ContributingFactor:
    type: String                   // "change", "design", "resource", etc.
    description: String
    impact: Float
    evidence: Any
    likelihood: Float
    preventable: Boolean
    preventionStrategy: String
END DATA STRUCTURE

DATA STRUCTURE Recommendation:
    category: String
    priority: String              // "high", "medium", "low"
    title: String
    description: String
    actions: List<String>
    estimatedEffort: String
    expectedImpact: String
    implementation: ImplementationGuidance
    status: String                // "pending", "in_progress", "completed"
END DATA STRUCTURE

DATA STRUCTURE IncidentLearnings:
    technical: List<Learning>
    process: List<Learning>
    detection: List<Learning>
    response: List<Learning>
    communication: List<Learning>
    tooling: List<Learning>
    training: List<Learning>
END DATA STRUCTURE
```

---

## 7. Error Handling

### 7.1 Detection Error Handling

```pseudocode
PROCEDURE HandleDetectionError(
    agent: Agent,
    error: Exception,
    signal: SignalSource
) -> void:
    // Handle errors during anomaly detection

    // Log error
    LogError(agent.audit, error, "detection_error", {
        signal: signal,
        stackTrace: error.stackTrace
    })

    // Record metric
    RecordMetric(agent.metrics, "detection.error", 1, {
        signal: signal.type,
        errorType: error.type
    })

    // Try fallback detection method
    IF HasFallbackDetectionMethod(signal) THEN
        TRY
            fallbackResult = ExecuteFallbackDetection(agent, signal)
            RETURN fallbackResult
        CATCH fallbackError:
            LogError(agent.audit, fallbackError, "fallback_detection_error")
        END TRY
    END IF

    // Alert if detection failure rate is high
    errorRate = CalculateDetectionErrorRate(agent, signal)
    IF errorRate > agent.config.detectionErrorThreshold THEN
        SendAlert(agent, "high_detection_error_rate", {
            signal: signal,
            errorRate: errorRate
        })
    END IF
END PROCEDURE
```

### 7.2 Classification Error Handling

```pseudocode
PROCEDURE HandleClassificationError(
    agent: Agent,
    error: Exception,
    anomaly: CorrelatedAnomaly
) -> SeverityClassification:
    // Handle errors during severity classification

    // Log error
    LogError(agent.audit, error, "classification_error", {
        anomalyId: anomaly.id
    })

    // Use conservative fallback classification
    fallbackSeverity = DetermineFallbackSeverity(anomaly)

    // Create classification with low confidence
    classification = NEW SeverityClassification(
        level: fallbackSeverity,
        score: 0.5,
        confidence: 0.3,  // Low confidence
        classifiedAt: CurrentTimestamp(),
        classifier: "fallback",
        metadata: {
            error: error.message,
            fallback: true
        }
    )

    // Flag for manual review
    FlagForManualReview(agent, anomaly, classification)

    RETURN classification
END PROCEDURE
```

### 7.3 Response Execution Error Handling

```pseudocode
PROCEDURE HandleResponseExecutionError(
    agent: Agent,
    error: Exception,
    incident: Incident,
    step: ExecutionStep
) -> void:
    // Handle errors during response execution

    // Log error with full context
    LogError(agent.audit, error, "response_execution_error", {
        incidentId: incident.id,
        stepId: step.id,
        action: step.action.name
    })

    // Notify stakeholders
    SendErrorNotification(agent, incident, step, error)

    // Execute error recovery if defined
    IF step.action.errorRecovery != NULL THEN
        TRY
            ExecuteErrorRecovery(agent, step.action.errorRecovery)
        CATCH recoveryError:
            LogError(agent.audit, recoveryError, "error_recovery_failed")
        END TRY
    END IF

    // Escalate if critical
    IF incident.severity.level == "critical" THEN
        EscalateIncident(agent, incident, "Response execution failed")
    END IF
END PROCEDURE
```

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-25
**Related Documents:**
- `/workspaces/llm-copilot-agent/docs/SPECIFICATION.md`
- `/workspaces/llm-copilot-agent/docs/core-algorithms-pseudocode.md`
- `/workspaces/llm-copilot-agent/docs/architecture-diagram.md`
