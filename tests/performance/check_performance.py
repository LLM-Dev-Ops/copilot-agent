#!/usr/bin/env python3
"""
Performance SLA Checker

Validates that performance test results meet SLA requirements:
- P95 latency < 2s
- Error rate < 1%
- Throughput > 100 req/s (for load tests)
"""

import json
import sys


def check_performance_sla(results_file):
    """Check if performance results meet SLA requirements."""
    with open(results_file) as f:
        results = json.load(f)

    metrics = results.get('metrics', {})
    passed = True

    print("=" * 60)
    print("Performance SLA Check Results")
    print("=" * 60)

    # Check P95 latency
    http_req_duration = metrics.get('http_req_duration', {})
    p95_latency = http_req_duration.get('p(95)', 0)
    p95_sla = 2000  # 2 seconds

    p95_status = "✅ PASS" if p95_latency < p95_sla else "❌ FAIL"
    print(f"P95 Latency:    {p95_latency:.2f}ms (SLA: <{p95_sla}ms) {p95_status}")

    if p95_latency >= p95_sla:
        passed = False

    # Check error rate
    http_req_failed = metrics.get('http_req_failed', {})
    error_rate = http_req_failed.get('rate', 0)
    error_sla = 0.01  # 1%

    error_status = "✅ PASS" if error_rate < error_sla else "❌ FAIL"
    print(f"Error Rate:     {error_rate*100:.2f}% (SLA: <{error_sla*100}%) {error_status}")

    if error_rate >= error_sla:
        passed = False

    # Check throughput (optional - only for load tests)
    http_reqs = metrics.get('http_reqs', {})
    throughput = http_reqs.get('rate', 0)
    throughput_sla = 100  # 100 req/s

    if throughput > 0:
        throughput_status = "✅ PASS" if throughput > throughput_sla else "⚠️  WARN"
        print(f"Throughput:     {throughput:.2f} req/s (Target: >{throughput_sla} req/s) {throughput_status}")
        # Note: Not failing on throughput, just warning

    # Check P50 and P99 for additional insights
    p50_latency = http_req_duration.get('p(50)', 0)
    p99_latency = http_req_duration.get('p(99)', 0)

    print(f"\nAdditional Metrics:")
    print(f"P50 Latency:    {p50_latency:.2f}ms")
    print(f"P99 Latency:    {p99_latency:.2f}ms")

    # Check intent accuracy if available
    intent_accuracy = metrics.get('intent_accuracy', {})
    if intent_accuracy:
        accuracy_rate = intent_accuracy.get('rate', 0)
        accuracy_sla = 0.95  # 95%
        accuracy_status = "✅ PASS" if accuracy_rate >= accuracy_sla else "❌ FAIL"
        print(f"Intent Accuracy: {accuracy_rate*100:.2f}% (SLA: >={accuracy_sla*100}%) {accuracy_status}")

        if accuracy_rate < accuracy_sla:
            passed = False

    print("=" * 60)

    if passed:
        print("✅ All SLAs met!")
        return True
    else:
        print("❌ Some SLAs not met. Please investigate before merging.")
        return False


def main():
    if len(sys.argv) != 2:
        print("Usage: check_performance.py <results.json>")
        sys.exit(1)

    results_file = sys.argv[1]

    try:
        if check_performance_sla(results_file):
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception as e:
        print(f"Error checking performance: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
