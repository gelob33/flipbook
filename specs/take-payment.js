// Level 2 of order-state-machine: the work (a BPMN-style process) behind the "Paying" state.
// Generic card payment, simplified and illustrative — not any real gateway's or bank's process.
(() => {
  const opening = [
    {
      say: "This is level 2, opened from the Paying state on level 1. The button at the top takes you back. This diagram shows the work behind that state: who does what, in order. The boxes are verbs, because they are tasks, not states.",
      do: [
        { token: "flow", at: "click" },
        { field: "card", key: "Level 1", value: "Order is in Paying" },
        { field: "card", key: "Amount", value: "$80, Visa ending 4242" },
        { status: "card", value: "Started", tone: "neutral" }
      ]
    },
    {
      say: "The shop sends the card details to a payment gateway, e.g. Stripe or Adyen. Shops don't talk to banks directly; the gateway connects them to every bank.",
      do: [{ token: "flow", at: "send" }]
    },
    {
      say: "The gateway asks the customer's bank: will you pay $80 from this card?",
      do: [{ token: "flow", at: "ask" }]
    },
    {
      say: "The bank checks the card: is it real, not expired, with enough money? There are three answers: yes, yes if the customer confirms it's them, or no.",
      do: [
        { token: "flow", at: "check" },
        { status: "card", value: "Bank checking", tone: "warn" }
      ]
    }
  ];

  const approved = [
    {
      say: "The bank approves and puts a hold on $80. The money hasn't moved yet; it's set aside so the customer can't spend it twice.",
      do: [
        { token: "flow", at: "approve" },
        { field: "card", key: "Bank", value: "approved, $80 on hold" }
      ]
    },
    {
      say: "The gateway captures the money: the hold turns into a real payment. Many shops wait and capture when the box ships, so they never charge for something they can't send.",
      do: [
        { token: "flow", at: "capture" },
        { field: "card", key: "Money", value: "$80 captured" }
      ]
    },
    {
      say: "The shop marks the order paid. That fires the 'paid' event on level 1, so the order moves from Paying to Paid, and this level-2 process ends.",
      do: [
        { token: "flow", at: "done" },
        { field: "card", key: "Level 1", value: "Order moves Paying → Paid" },
        { status: "card", value: "Paid", tone: "good" }
      ]
    }
  ];

  window.VIZ = {
    title: "Take payment (level 2 of an online order)",
    subtitle: "The work behind the 'Paying' state · simplified, illustrative",
    scene: {
      flow: {
        type: "flow",
        token: "payment",
        lanes: ["Customer", "Shop", "Payment gateway", "Bank"],
        nodes: {
          click:   { lane: "Customer",        label: "Click Pay" },
          send:    { lane: "Shop",            label: "Send card details" },
          ask:     { lane: "Payment gateway", label: "Ask bank to approve" },
          check:   { lane: "Bank",            label: "Check card", shape: "decision" },
          confirm: { lane: "Customer",        label: "Confirm in bank app" },
          approve: { lane: "Bank",            label: "Approve, hold $80" },
          refuse:  { lane: "Payment gateway", label: "Report decline", tone: "bad" },
          capture: { lane: "Payment gateway", label: "Capture $80" },
          failed:  { lane: "Shop",            label: "Show 'card declined'", tone: "bad" },
          done:    { lane: "Shop",            label: "Mark order paid", tone: "good" }
        },
        edges: [
          ["click", "send"],
          ["send", "ask"],
          ["ask", "check"],
          ["check", "approve", "ok"],
          ["check", "confirm", "confirm it's you"],
          ["check", "refuse", "no"],
          ["confirm", "approve"],
          ["approve", "capture"],
          ["capture", "done"],
          ["refuse", "failed"]
        ]
      },
      card: { type: "card", title: "Payment for order #1042" }
    },

    scenarios: [
      {
        name: "Approved",
        steps: [
          ...opening,
          {
            say: "The card is fine and the amount is small, so the bank says yes straight away.",
            do: [{ field: "card", key: "Check", value: "ok" }]
          },
          ...approved
        ]
      },
      {
        name: "Confirm it's you",
        steps: [
          ...opening,
          {
            say: "The bank wants proof it's really the card owner. This is 3-D Secure: the customer's banking app pops up and asks them to confirm.",
            do: [
              { token: "flow", at: "confirm" },
              { field: "card", key: "Check", value: "asked customer to confirm" },
              { status: "card", value: "Waiting for customer", tone: "warn" }
            ]
          },
          {
            say: "The customer taps Confirm in the app. Now the bank knows it's them, so it can approve.",
            do: [{ field: "card", key: "Check", value: "customer confirmed" }]
          },
          ...approved
        ]
      },
      {
        name: "Declined",
        steps: [
          ...opening,
          {
            say: "The bank says no, e.g. the card has expired. Banks often don't say why, to stop fraudsters learning what works.",
            do: [
              { token: "flow", at: "refuse" },
              { field: "card", key: "Check", value: "declined" },
              { status: "card", value: "Declined", tone: "bad" }
            ]
          },
          {
            say: "The shop shows 'card declined'. That fires the 'declined' event on level 1, so the order moves from Paying to Payment failed, where the customer can retry.",
            do: [
              { token: "flow", at: "failed" },
              { field: "card", key: "Level 1", value: "Order moves Paying → Payment failed" }
            ]
          }
        ]
      }
    ]
  };
})();
