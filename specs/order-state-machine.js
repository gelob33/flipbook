// An online order as a state machine. Generic shop, illustrative steps.
// Also a test of how well the flow type draws state machines (self-loop on "Paying").
(() => {
  const opening = [
    {
      say: "An order is a state machine: at any moment it is in exactly one state. The yellow tag shows which one. Here it starts in Cart, e.g. one pair of shoes, $80.",
      do: [
        { token: "flow", at: "cart" },
        { field: "card", key: "Items", value: "1 × running shoes, $80" },
        { status: "card", value: "Cart", tone: "neutral" }
      ]
    },
    {
      say: "An event moves the order from one state to the next. Here the event is 'check out': the customer clicks the button and types an address.",
      do: [
        { token: "flow", at: "checkout" },
        { field: "card", key: "Ship to", value: "12 Elm St, Brisbane" },
        { status: "card", value: "Checkout", tone: "neutral" }
      ]
    },
    {
      say: "The event 'pay' sends the card details to the bank. The order now waits in Paying until the bank answers. The ⊕ on Paying opens level 2: the work that happens inside this state.",
      do: [
        { token: "flow", at: "paying" },
        { field: "card", key: "Card", value: "Visa ending 4242" },
        { status: "card", value: "Paying", tone: "warn" }
      ]
    },
    {
      say: "The bank is slow, so the shop asks again after 5 seconds. An event happened, but the state stays the same: Paying goes back to Paying. That is a self-loop.",
      do: [
        { token: "flow", at: "paying" },
        { field: "card", key: "Bank", value: "no answer yet, asked again" }
      ]
    }
  ];

  const paid = [
    {
      say: "The bank says yes. The event 'paid' has a guard, [card ok]: a check that must be true before the move can happen.",
      do: [
        { token: "flow", at: "paid" },
        { field: "card", key: "Bank", value: "approved" },
        { status: "card", value: "Paid", tone: "good" }
      ]
    },
    {
      say: "The warehouse packs the shoes and hands them to the courier. The event 'ship' moves the order on and adds a tracking number.",
      do: [
        { token: "flow", at: "shipped" },
        { field: "card", key: "Tracking", value: "AU-88213" },
        { status: "card", value: "Shipped", tone: "good" }
      ]
    },
    {
      say: "The courier delivers. Delivered is a final state: no event leads out of it, so the order is done.",
      do: [
        { token: "flow", at: "delivered" },
        { status: "card", value: "Delivered", tone: "good" }
      ]
    }
  ];

  window.VIZ = {
    title: "An online order as a state machine",
    subtitle: "Generic shop · illustrative · states, events and guards",
    scene: {
      flow: {
        type: "flow",
        token: "order",
        lanes: ["Order", "Problems"],
        nodes: {
          cart:      { lane: "Order",    label: "Cart", col: 0 },
          checkout:  { lane: "Order",    label: "Checkout", col: 1 },
          paying:    { lane: "Order",    label: "Paying", col: 2, opens: "take-payment" },
          paid:      { lane: "Order",    label: "Paid", col: 3 },
          shipped:   { lane: "Order",    label: "Shipped", col: 4 },
          delivered: { lane: "Order",    label: "Delivered", tone: "good", col: 5 },
          failed:    { lane: "Problems", label: "Payment failed", tone: "warn", col: 3 },
          cancelled: { lane: "Problems", label: "Cancelled", tone: "bad", col: 4 }
        },
        edges: [
          ["cart", "checkout", "check out"],
          ["checkout", "paying", "pay"],
          ["paying", "paying", "wait"],
          ["paying", "paid", "paid [card ok]"],
          ["paying", "failed", "declined"],
          ["failed", "paying", "retry"],
          ["failed", "cancelled", "give up"],
          ["paid", "shipped", "ship"],
          ["shipped", "delivered", "deliver"],
          ["paid", "cancelled", "cancel"]
        ]
      },
      card: { type: "card", title: "Order #1042" }
    },

    scenarios: [
      {
        name: "Paid first time",
        steps: [...opening, ...paid]
      },
      {
        name: "Declined, then retry",
        steps: [
          ...opening,
          {
            say: "This time the bank says no, e.g. the card has expired. The event 'declined' moves the order to Payment failed.",
            do: [
              { token: "flow", at: "failed" },
              { field: "card", key: "Bank", value: "declined: card expired" },
              { status: "card", value: "Payment failed", tone: "warn" }
            ]
          },
          {
            say: "The customer types a new card. The event 'retry' sends the order back to Paying. States can loop back; they don't only go forward.",
            do: [
              { token: "flow", at: "paying" },
              { field: "card", key: "Card", value: "Mastercard ending 5100" },
              { status: "card", value: "Paying", tone: "warn" }
            ]
          },
          ...paid
        ]
      },
      {
        name: "Cancelled after paying",
        steps: [
          ...opening,
          paid[0],
          {
            say: "Before the shoes ship, the customer changes their mind. The event 'cancel' is allowed from Paid, but not from Shipped: once the box has left, the shop needs a return instead.",
            do: [
              { token: "flow", at: "cancelled" },
              { field: "card", key: "Refund", value: "$80 back to Visa 4242" },
              { status: "card", value: "Cancelled", tone: "bad" }
            ]
          }
        ]
      }
    ]
  };
})();
