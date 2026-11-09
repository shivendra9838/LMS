// Deployment-controlled policy. Changes to these rules produce a new policy hash in every assessment.
module.exports = Object.freeze({
  version: 'repayment-v2', minDueInstallments: 5, minCompletedInstallments: 3,
  provisional: { minDueInstallments: 3, minVerifiedCompletedInstallments: 3 },
  confidence: { highDueInstallments: 15, highVerifiedCompletedInstallments: 10 },
  thresholds: { good: 80, review: 50 },
  weights: { lateRate: 25, overdueRatio: 40, lateness: 10, consecutiveMisses: 20, partialRate: 5 },
  latenessCapDays: 30, consecutiveCap: 3,
  goodRequiresNoAdverseHistory: true
});
