// Generic private motor insurance quote. Steps, rules and prices are illustrative —
// not any real insurer's process.
(() => {
  // the first four steps are the same in every scenario; only the customer differs
  const intake = (c) => [
    {
      say: "A customer starts a quote online. The yellow 'quote' tag is the quote itself — watch it travel through the business.",
      do: [
        { token: "flow", at: "start" },
        { status: "card", value: "Draft", tone: "neutral" }
      ]
    },
    {
      say: "The portal asks about the driver first. Age, years licensed and past claims are among the strongest predictors of future claims.",
      do: [
        { token: "flow", at: "collect" },
        { field: "card", key: "Driver", value: c.driver },
        { field: "card", key: "History", value: c.history }
      ]
    },
    {
      say: "Then the car, where it's kept overnight and how it's used. Every answer becomes a rating factor later, which is why the form is long.",
      do: [
        { field: "card", key: "Vehicle", value: c.vehicle },
        { field: "card", key: "Garaged", value: c.garaged },
        { field: "card", key: "Usage", value: c.usage },
        { field: "card", key: "Cover", value: c.cover }
      ]
    },
    {
      say: "Data services check and fill in what's slow or error-prone to type: the exact model and market value from the registration, and past claims from an industry database.",
      do: [
        { token: "flow", at: "enrich" },
        { field: "card", key: "Vehicle", value: `${c.vehicle} · worth ${c.value}` },
        { field: "card", key: "History", value: `${c.history} ✓ verified` }
      ]
    }
  ];

  const rulesStep = (verdict) => ({
    say: `Underwriting rules run before any pricing. They decide whether the insurer wants this risk at all: each rule passes, refers the quote to a person, or declines it. ${verdict}`,
    do: [{ token: "flow", at: "rules" }]
  });

  window.VIZ = {
    title: "Private motor insurance: how a quote is made",
    subtitle: "Generic process · illustrative rules and prices, not a real insurer's",
    scene: {
      flow: {
        type: "flow",
        token: "quote",
        lanes: ["Customer", "Quote portal", "Data services", "Underwriting", "Rating engine"],
        nodes: {
          start:   { lane: "Customer",      label: "Start a quote" },
          collect: { lane: "Quote portal",  label: "Collect risk details" },
          enrich:  { lane: "Data services", label: "Look up vehicle & claims" },
          rules:   { lane: "Underwriting",  label: "Eligibility rules", shape: "decision" },
          refer:   { lane: "Underwriting",  label: "Refer to underwriter", tone: "warn" },
          decline: { lane: "Customer",      label: "Can't offer cover", tone: "bad" },
          rate:    { lane: "Rating engine", label: "Calculate premium" },
          quote:   { lane: "Customer",      label: "Show quote", tone: "good" }
        },
        edges: [
          ["start", "collect"],
          ["collect", "enrich"],
          ["enrich", "rules"],
          ["rules", "rate", "accept"],
          ["rules", "refer", "refer"],
          ["rules", "decline", "decline"],
          ["rate", "quote"]
        ]
      },
      card: { type: "card", title: "Quote" },
      premium: { type: "waterfall", title: "Premium build-up", currency: "$" }
    },

    scenarios: [
      {
        name: "Clean record → quoted",
        steps: [
          ...intake({
            driver: "34 · licensed 16 yrs",
            history: "No claims in 5 yrs",
            vehicle: "2021 Corolla Ascent",
            value: "$26k",
            garaged: "Locked garage · suburban",
            usage: "Private · 12,000 km/yr",
            cover: "Comprehensive · $800 excess"
          }),
          rulesStep("Nothing fires for this driver."),
          {
            say: "All rules pass, so the quote goes to the rating engine to be priced.",
            do: [
              { token: "flow", at: "rate" },
              { status: "card", value: "Pricing", tone: "neutral" }
            ]
          },
          {
            say: "Pricing starts from a base rate for this model in this area: how often similar cars nearby are stolen, damaged or crashed.",
            do: [{ bar: "premium", label: "Base rate", value: 820 }]
          },
          {
            say: "Drivers in their 30s with long licence histories claim less than average, so a small discount. A 19-year-old would get a big loading here instead.",
            do: [{ bar: "premium", label: "Driver profile", value: -60 }]
          },
          {
            say: "Five claim-free years earn the top no-claim discount: the biggest single factor in this quote.",
            do: [{ bar: "premium", label: "No-claim discount", value: -245 }]
          },
          {
            say: "The customer chose an $800 excess instead of the standard $650. Paying more of any claim themselves lowers the premium.",
            do: [{ bar: "premium", label: "Higher excess", value: -45 }]
          },
          {
            say: "Taxes and levies (e.g. GST, stamp duty) go on last, because they're calculated on the price, not on the risk.",
            do: [{ bar: "premium", label: "Taxes & levies", value: 94 }]
          },
          {
            say: "The customer sees $564 a year and a quote reference. It's saved, so they can come back and buy within 30 days without re-entering anything.",
            do: [
              { token: "flow", at: "quote" },
              { total: "premium", label: "Annual premium" },
              { field: "card", key: "Ref", value: "Q-10482 · valid 30 days" },
              { status: "card", value: "Quoted", tone: "good" }
            ]
          }
        ]
      },
      {
        name: "Modified car → referred",
        steps: [
          ...intake({
            driver: "29 · licensed 11 yrs",
            history: "1 claim in 5 yrs",
            vehicle: "2019 WRX STI, modified",
            value: "$48k",
            garaged: "Street · inner city",
            usage: "Private · 15,000 km/yr",
            cover: "Comprehensive · $1,000 excess"
          }),
          rulesStep("This time a rule flags the aftermarket engine tune: standard pricing assumes a factory car."),
          {
            say: "Instead of guessing a price, the quote goes to a human underwriter. They might accept with special terms (say, a higher excess), ask for photos and receipts, or decline. The customer is told they'll hear back.",
            do: [
              { token: "flow", at: "refer" },
              { field: "card", key: "Flag", value: "Engine modification" },
              { status: "card", value: "Referred", tone: "warn" }
            ]
          }
        ]
      },
      {
        name: "Claims history → declined",
        steps: [
          ...intake({
            driver: "22 · licensed 4 yrs",
            history: "3 at-fault claims in 2 yrs",
            vehicle: "2016 Mazda3",
            value: "$12k",
            garaged: "Driveway · suburban",
            usage: "Private · 20,000 km/yr",
            cover: "Comprehensive · $650 excess"
          }),
          rulesStep("This time a hard rule fires: more than 2 at-fault claims in 3 years is outside this insurer's appetite."),
          {
            say: "The customer is told the insurer can't offer cover online, and no price is ever calculated. Another insurer with a different appetite might still say yes.",
            do: [
              { token: "flow", at: "decline" },
              { field: "card", key: "Reason", value: "Claims frequency" },
              { status: "card", value: "Declined", tone: "bad" }
            ]
          }
        ]
      }
    ]
  };
})();
