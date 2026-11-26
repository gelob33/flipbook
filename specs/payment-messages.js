// Level 3 of order-state-machine → take-payment: the messages behind "Ask bank to approve".
// Generic card payment, simplified and illustrative — not any real gateway's API.
(() => {
  const opening = [
    {
      say: "This is level 3, opened from 'Ask bank to approve'. Each column is someone who takes part, and time runs down the page: every message is an arrow under the last one.",
      do: []
    },
    {
      say: "The shop sends the payment gateway a message: charge $80 to the card ending 4242. The shop never sees the full card number; the gateway keeps it.",
      do: [{ send: "seq", from: "shop", to: "gateway", label: "charge $80, card …4242" }]
    },
    {
      say: "The gateway asks the customer's bank to approve it. The gateway knows which bank from the card number's first digits.",
      do: [{ send: "seq", from: "gateway", to: "bank", label: "approve $80?" }]
    },
    {
      say: "The bank checks the card on its own side: is it real, not expired, with $80 to spend? A message from a column to itself is work done inside, not sent anywhere.",
      do: [{ send: "seq", from: "bank", to: "bank", label: "check card and balance" }]
    }
  ];

  const approved = [
    {
      say: "The bank answers yes, with an approval code. Dashed arrows are replies: answers to an earlier message, here to message 2.",
      do: [{ send: "seq", from: "bank", to: "gateway", label: "approved, code 7Q4K", reply: true }]
    },
    {
      say: "The gateway answers the shop's message 1 with a payment ID, e.g. pay_81. The shop keeps it to capture the money later or to refund it.",
      do: [{ send: "seq", from: "gateway", to: "shop", label: "ok, payment pay_81", reply: true }]
    },
    {
      say: "Read the arrows top to bottom and you have the whole conversation. On level 2 this was one box, 'Ask bank to approve'; the breadcrumb at the top takes you back.",
      do: []
    }
  ];

  window.VIZ = {
    title: "Ask bank to approve (level 3 of an online order)",
    subtitle: "The messages behind one task · simplified, illustrative, not a real gateway's API",
    scene: {
      seq: {
        type: "sequence",
        actors: { customer: "Customer's phone", shop: "Shop", gateway: "Payment gateway", bank: "Bank" }
      }
    },

    scenarios: [
      {
        name: "Approved",
        steps: [...opening, ...approved]
      },
      {
        name: "Confirm it's you",
        steps: [
          ...opening,
          {
            say: "This time the bank wants proof it's the card owner (3-D Secure). It sends a message straight to the customer's banking app, past the shop and gateway.",
            do: [{ send: "seq", from: "bank", to: "customer", label: "confirm $80 at Shop?" }]
          },
          {
            say: "The customer taps Confirm and unlocks the app with their face or a PIN. The app replies to the bank.",
            do: [{ send: "seq", from: "customer", to: "bank", label: "yes, it's me", reply: true }]
          },
          ...approved
        ]
      },
      {
        name: "Declined",
        steps: [
          ...opening,
          {
            say: "The bank says no, e.g. the card has expired. It's still a reply to message 2, just a different answer.",
            do: [{ send: "seq", from: "bank", to: "gateway", label: "declined: card expired", reply: true }]
          },
          {
            say: "The gateway tells the shop with a short code, card_declined, not the bank's reason. The shop shows 'card declined', and level 1 moves the order to Payment failed.",
            do: [{ send: "seq", from: "gateway", to: "shop", label: "error: card_declined", reply: true }]
          }
        ]
      }
    ]
  };
})();
