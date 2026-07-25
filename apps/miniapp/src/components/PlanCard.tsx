import type { Plan } from '../data'

export function PlanCard({ plan, onSelect }: { plan: Plan; onSelect: (plan: Plan) => void }) {
  return (
    <article className="plan-card">
      <div className="plan-card-top">
        <span className="eyebrow">{plan.badge}</span>
        <span className="status-dot">LIVE</span>
      </div>
      <h3>{plan.name}</h3>
      <p className="merchant">by {plan.merchant}</p>
      <p className="plan-copy">{plan.description}</p>
      <ul>
        {plan.benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      <div className="price-row">
        <div>
          <strong>{plan.price} mUSDC</strong>
          <span>/ {plan.period}</span>
        </div>
        <button className="small-button" onClick={() => onSelect(plan)}>
          Review
        </button>
      </div>
    </article>
  )
}
