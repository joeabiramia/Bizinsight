"""Market Intelligence Module.

Architecture is ready to connect to real external data sources:
- Market news APIs
- Currency exchange rate feeds
- Competitor pricing data
- Industry trend databases

For now uses realistic mock data per industry.
"""
from __future__ import annotations

from datetime import datetime

_MOCK_DATA: dict[str, dict] = {
    "retail": {
        "trends": [
            {
                "title": "E-commerce Growth Continues",
                "direction": "positive",
                "impact": "high",
                "summary": "Online retail grew 12% YoY. Omnichannel strategies outperform pure-play online by 30%.",
                "source": "Industry Report Q1 2025",
            },
            {
                "title": "Supply Chain Normalization",
                "direction": "positive",
                "impact": "medium",
                "summary": "Global supply chain delays reduced 40%. Average lead times back to pre-2020 levels.",
                "source": "Supply Chain Monitor",
            },
            {
                "title": "Consumer Spending Caution",
                "direction": "negative",
                "impact": "high",
                "summary": "Consumer confidence down 8 points. Discretionary spending showing 5% decline.",
                "source": "Consumer Sentiment Index",
            },
        ],
        "benchmarks": {
            "gross_margin_pct": 42.0,
            "inventory_turnover": 8.5,
            "customer_acquisition_cost": 45.0,
            "avg_order_value_usd": 87.0,
            "customer_retention_rate_pct": 65.0,
        },
    },
    "ecommerce": {
        "trends": [
            {
                "title": "Mobile Commerce Dominates",
                "direction": "positive",
                "impact": "high",
                "summary": "62% of purchases now on mobile. PWA adoption improves checkout conversion 15%.",
                "source": "Mobile Commerce Index",
            },
            {
                "title": "Same-Day Delivery Expectation",
                "direction": "neutral",
                "impact": "medium",
                "summary": "48% of consumers expect same-day delivery. Fulfillment costs up 22%.",
                "source": "Delivery Benchmark Report",
            },
            {
                "title": "Social Commerce Rising",
                "direction": "positive",
                "impact": "medium",
                "summary": "Instagram and TikTok shopping revenue grew 35% YoY. Influencer ROI averages 5.2×.",
                "source": "Social Commerce Report",
            },
        ],
        "benchmarks": {
            "cart_abandonment_rate_pct": 69.8,
            "customer_lifetime_value_usd": 312.0,
            "return_rate_pct": 20.8,
            "conversion_rate_pct": 2.7,
        },
    },
    "finance": {
        "trends": [
            {
                "title": "Rate Environment Stabilizing",
                "direction": "positive",
                "impact": "high",
                "summary": "Central bank rates stabilizing post-hike cycle. Loan demand recovering in Q2.",
                "source": "Financial Markets Review",
            },
            {
                "title": "Digital Banking Adoption",
                "direction": "positive",
                "impact": "high",
                "summary": "Digital-only banking customers grew 28% YoY. Branch visits down 35%.",
                "source": "Banking Transformation Index",
            },
            {
                "title": "Regulatory Compliance Costs",
                "direction": "negative",
                "impact": "medium",
                "summary": "Compliance costs up 12% due to new data privacy and ESG reporting mandates.",
                "source": "Regulatory Compliance Monitor",
            },
        ],
        "benchmarks": {
            "net_interest_margin_pct": 3.2,
            "cost_to_income_ratio": 58.0,
            "return_on_equity_pct": 12.5,
            "non_performing_loans_pct": 1.8,
        },
    },
    "travel": {
        "trends": [
            {
                "title": "Revenge Travel Sustaining",
                "direction": "positive",
                "impact": "high",
                "summary": "Leisure travel bookings 18% above 2019 levels. Premium segment leads growth.",
                "source": "Travel Industry Monitor",
            },
            {
                "title": "Business Travel Recovery",
                "direction": "positive",
                "impact": "medium",
                "summary": "Corporate travel at 85% of 2019 volumes. Hybrid events driving short-haul demand.",
                "source": "GBTA Report",
            },
            {
                "title": "Fuel Cost Volatility",
                "direction": "negative",
                "impact": "high",
                "summary": "Jet fuel costs remain 25% above historical average, pressuring airline margins.",
                "source": "Aviation Cost Index",
            },
        ],
        "benchmarks": {
            "occupancy_rate_pct": 72.0,
            "revenue_per_available_room_usd": 145.0,
            "customer_satisfaction_score": 78.0,
            "booking_lead_time_days": 21.0,
        },
    },
}

_DEFAULT_DATA: dict = {
    "trends": [
        {
            "title": "AI Adoption Accelerating",
            "direction": "positive",
            "impact": "high",
            "summary": "Businesses using AI analytics report 22% efficiency gains and 15% revenue increase.",
            "source": "McKinsey Global Institute 2025",
        },
        {
            "title": "Talent Market Tightening",
            "direction": "negative",
            "impact": "medium",
            "summary": "Skilled worker availability down 15%. Average hiring time increased by 3 weeks.",
            "source": "HR Benchmark Report",
        },
        {
            "title": "Sustainability Reporting Mandates",
            "direction": "neutral",
            "impact": "medium",
            "summary": "68% of enterprise buyers now require ESG disclosures. Reporting frameworks expanding.",
            "source": "ESG Compliance Tracker",
        },
    ],
    "benchmarks": {
        "revenue_growth_pct": 8.5,
        "operating_margin_pct": 14.2,
        "employee_productivity_usd": 125000.0,
        "nps_score": 42.0,
    },
}

_CURRENCY_RATES = {
    "EUR/USD": 1.085,
    "GBP/USD": 1.271,
    "USD/JPY": 148.5,
    "USD/CAD": 1.363,
    "AUD/USD": 0.647,
    "USD/CHF": 0.893,
    "note": "Mock rates — connect to a live FX API for real-time data",
}


def get_market_intelligence(industry: str | None = None) -> dict:
    """Return market intelligence for the given industry."""
    key = (industry or "").lower().strip()
    # Try partial match
    matched_data = None
    for k, v in _MOCK_DATA.items():
        if k in key or key in k:
            matched_data = v
            break
    data = matched_data or _DEFAULT_DATA

    alerts = [
        {
            "type": "market_risk",
            "severity": "high",
            "title": t["title"],
            "message": t["summary"],
            "action": "Review your strategy in light of this development",
        }
        for t in data["trends"]
        if t["direction"] == "negative" and t["impact"] == "high"
    ]

    return {
        "industry": industry or "General",
        "as_of_date": datetime.now().strftime("%Y-%m-%d"),
        "data_source": "mock_market_intelligence",
        "integration_note": (
            "Placeholder data. Connect to NewsAPI, Alpha Vantage, or SerpAPI "
            "for live market intelligence."
        ),
        "market_trends": data["trends"],
        "industry_benchmarks": data.get("benchmarks", {}),
        "currency_rates": _CURRENCY_RATES,
        "market_alerts": alerts,
    }


def get_contextual_recommendations(industry: str | None = None) -> list[dict]:
    """Return AI recommendations based on market conditions."""
    intel = get_market_intelligence(industry)
    recs = []
    for trend in intel["market_trends"]:
        if trend["direction"] == "positive":
            recs.append({
                "type": "opportunity",
                "source": "market_intelligence",
                "title": f"Market Opportunity: {trend['title']}",
                "insight": trend["summary"],
                "action": "Consider aligning your strategy to capitalize on this trend",
                "source_label": trend.get("source", "Market Intelligence"),
            })
        elif trend["direction"] == "negative":
            recs.append({
                "type": "risk",
                "source": "market_intelligence",
                "title": f"Market Risk: {trend['title']}",
                "insight": trend["summary"],
                "action": "Prepare mitigation plans for this market headwind",
                "source_label": trend.get("source", "Market Intelligence"),
            })
    return recs
