// Pre-built demo dataset — Travel Agency Bookings
// Used for the live demo mode (no login required)

export const DEMO_FILE_ID = "demo-travel-agency-2024";

export const DEMO_ANALYSIS = {
  file_id: DEMO_FILE_ID,
  filename: "travel_agency_bookings_2024.csv",
  analysis: {
    industry: "travel",
    shape: { rows: 2600, columns: 12 },
    columns: ["BookingID","CustomerName","Destination","TravelDate","ReturnDate","BookingDate","TravelType","NumberOfTravelers","TotalAmount","AgentName","Status","PaymentMethod"],
    data_types: { BookingID:"int", TotalAmount:"float", NumberOfTravelers:"int" },
    missing_values: { AgentName: 12, PaymentMethod: 5 },
    generated_at: new Date().toISOString(),
    column_types: { numeric: ["TotalAmount","NumberOfTravelers"], categorical: ["Destination","TravelType","AgentName","Status"], date: ["TravelDate","ReturnDate","BookingDate"] },
    numeric_summary: {
      TotalAmount: { total: 4_287_450, mean: 1649.8, median: 1420, std: 892.4, min: 210, max: 8900, p90: 3100 },
      NumberOfTravelers: { total: 7254, mean: 2.79, median: 2, std: 1.4, min: 1, max: 12, p90: 5 },
    },
    categorical_summary: {
      Destination: { unique_count: 47, top_value: "Paris", top_count: 312 },
      TravelType: { unique_count: 4, top_value: "Leisure", top_count: 1820 },
      Status: { unique_count: 3, top_value: "Confirmed", top_count: 2210 },
      AgentName: { unique_count: 18, top_value: "Sarah Mitchell", top_count: 287 },
    },
    chart_data: {
      by_destination: [
        { name: "Paris", value: 312 }, { name: "Dubai", value: 284 }, { name: "New York", value: 261 },
        { name: "London", value: 243 }, { name: "Tokyo", value: 218 }, { name: "Bali", value: 197 },
        { name: "Sydney", value: 176 }, { name: "Rome", value: 164 }, { name: "Barcelona", value: 152 },
        { name: "Maldives", value: 143 },
      ],
      by_travel_type: [
        { name: "Leisure", value: 1820 }, { name: "Business", value: 489 },
        { name: "Honeymoon", value: 187 }, { name: "Adventure", value: 104 },
      ],
      by_status: [
        { name: "Confirmed", value: 2210 }, { name: "Pending", value: 287 }, { name: "Cancelled", value: 103 },
      ],
      revenue_by_month: [
        { name: "Jan", value: 298400 }, { name: "Feb", value: 312800 }, { name: "Mar", value: 387200 },
        { name: "Apr", value: 421600 }, { name: "May", value: 398400 }, { name: "Jun", value: 445200 },
        { name: "Jul", value: 512800 }, { name: "Aug", value: 489600 }, { name: "Sep", value: 356400 },
        { name: "Oct", value: 334800 }, { name: "Nov", value: 298400 }, { name: "Dec", value: 431850 },
      ],
      top_agents: [
        { name: "Sarah Mitchell", value: 287 }, { name: "James Carter", value: 264 },
        { name: "Emma Wilson", value: 241 }, { name: "David Chen", value: 228 },
        { name: "Olivia Martinez", value: 196 },
      ],
    },
    preview: {
      headers: ["BookingID","CustomerName","Destination","TravelDate","TotalAmount","AgentName","Status"],
      rows: [
        ["B1001","Alice Johnson","Paris","2024-03-15","2450","Sarah Mitchell","Confirmed"],
        ["B1002","Robert Kim","Dubai","2024-03-18","3200","James Carter","Confirmed"],
        ["B1003","Maria Garcia","New York","2024-03-20","1890","Emma Wilson","Pending"],
        ["B1004","James Brown","Bali","2024-04-02","4100","David Chen","Confirmed"],
        ["B1005","Sophie Chen","Tokyo","2024-04-05","3750","Olivia Martinez","Confirmed"],
      ],
    },
  },
};

export const DEMO_INSIGHTS = [
  {
    type: "opportunity",
    priority: "high",
    title: "Top 3 destinations drive 34% of all bookings",
    observation: "Paris, Dubai, and New York collectively account for 857 bookings (34% of total).",
    interpretation: "High concentration in premium destinations suggests strong brand positioning in luxury travel segment.",
    action: "Increase marketing spend on these 3 destinations and introduce upsell packages (VIP lounges, transfers).",
    data_point: "857 bookings, $1.4M revenue",
  },
  {
    type: "risk",
    priority: "critical",
    title: "103 bookings cancelled — $198K in lost revenue",
    observation: "4% cancellation rate. Most cancellations occur 72+ hours after booking.",
    interpretation: "Flexible booking policies may be needed. Many cancellations likely preventable with follow-up automation.",
    action: "Implement automated day-after-booking confirmation SMS. Add cancellation protection package.",
    data_point: "103 cancellations, avg $1,923 each",
  },
  {
    type: "performance",
    priority: "high",
    title: "Sarah Mitchell outperforms the team by 30%",
    observation: "Top agent Sarah Mitchell closed 287 bookings — 30% above the next agent.",
    interpretation: "Clear performance gap suggests knowledge transfer opportunity. Her approach likely drives higher conversion.",
    action: "Document her sales process. Create an internal playbook. Shadow program for bottom-quartile agents.",
    data_point: "287 vs team avg of 144",
  },
  {
    type: "revenue",
    priority: "medium",
    title: "July is your peak month — 55% above January",
    observation: "Revenue peaks in July ($512K) and troughs in January ($298K), a 72% seasonal swing.",
    interpretation: "Strong summer seasonality. Q1 needs targeted promotions to sustain revenue floor.",
    action: "Launch January early-bird campaign. Pre-sell summer slots in February to smooth revenue.",
    data_point: "$512K Jul vs $298K Jan",
  },
  {
    type: "opportunity",
    priority: "medium",
    title: "Honeymoon segment has highest average booking value",
    observation: "Honeymoon bookings average $3,840 — 133% higher than leisure average of $1,648.",
    interpretation: "Premium willingness-to-pay in this segment. Currently only 7% of bookings.",
    action: "Create a dedicated Honeymoon Experiences landing page. Partner with luxury resorts.",
    data_point: "187 bookings, $3,840 avg",
  },
];

export const DEMO_HEALTH = {
  overall_score: 74,
  overall_grade: "B",
  summary: "Your travel business is performing well with strong peak-season revenue, but cancellation rates and low-season dips are opportunities for improvement.",
  dimensions: [
    { name: "Revenue Stability", score: 68, grade: "C", explanation: "High seasonal variance (72% swing). Recommend Q1 promotions to reduce trough." },
    { name: "Growth Trajectory", score: 81, grade: "B", explanation: "Consistent YoY growth in premium destinations. Summer demand strong." },
    { name: "Operational Risk", score: 73, grade: "B", explanation: "4% cancellation rate is manageable. 287 pending bookings require follow-up." },
  ],
};

export const DEMO_PREDICTIONS = {
  next_month_revenue: 467_200,
  trend: "up",
  confidence: 0.82,
  explanation: "Based on 12-month seasonality and current booking pace, next month revenue is projected at $467K (±$42K). Summer bookings are tracking 8% ahead of last year.",
};

export const DEMO_CHAT_HISTORY = [
  {
    question: "What is our total revenue this year?",
    answer: "Your total revenue for 2024 is **$4,287,450** across 2,600 bookings. Your best month was July at $512,800, and your average booking value is $1,649.",
    source: "rag_openai",
    grounded: true,
    insights: ["July alone accounts for 12% of annual revenue", "Average booking value grew 8% vs 2023"],
  },
  {
    question: "Who is our top performing agent?",
    answer: "**Sarah Mitchell** is your top agent with 287 bookings — 30% above the team average of 144. She specializes in European destinations and has a 94% confirmation rate (vs 85% team average). James Carter is #2 with 264 bookings.",
    source: "rag_openai",
    grounded: true,
    insights: ["Sarah's avg booking value ($1,920) is 16% above team average", "Top 3 agents account for 44% of all revenue"],
  },
];

export const DEMO_KPIS = [
  { label: "Total Revenue", value: "$4.29M", trend: "up" as const, change: "+12.4%", sub: "vs last year" },
  { label: "Total Bookings", value: "2,600", trend: "up" as const, change: "+8.2%", sub: "confirmed + pending" },
  { label: "Avg Booking Value", value: "$1,649", trend: "up" as const, change: "+4.1%", sub: "per booking" },
  { label: "Cancellation Rate", value: "4.0%", trend: "down" as const, change: "-0.8%", sub: "vs Q1 average" },
  { label: "Active Agents", value: "18", trend: "neutral" as const, change: "+2", sub: "this quarter" },
  { label: "Top Destination", value: "Paris", trend: "up" as const, change: "312 bookings", sub: "most popular" },
];
