// How to use pstack's /reframe skill (by Lauren Tan / poteto), then feed the result into
// /visualize. Scenario 1's terms come from a real run on this repo's visualize skill;
// scenario 2 is illustrative.
(() => {
  // ex: { before, desc, files, sees, eg: { term, verify, borrow, gap, use }, terms, borrowed, gaps, after }
  const start = (ex) => [
    {
      say: "You know what you want, but not the words for it. /reframe teaches you the words experts use, so you can ask for exactly what you mean.",
      do: [
        { token: "flow", at: "idea" },
        { field: "card", key: "Before", value: ex.before },
        { status: "card", value: "Fuzzy", tone: "warn" }
      ]
    },
    {
      say: "Open Claude Code and type /reframe in the prompt box, where you normally chat. Claude never starts this skill by itself; you have to type it.",
      do: [
        { token: "flow", at: "type" },
        { field: "card", key: "You type", value: "/reframe" }
      ]
    },
    {
      say: `After the command, say what you want in your own words. Rough is fine. For example: "${ex.desc}"`,
      do: [{ field: "card", key: "You type", value: `/reframe ${ex.desc}` }]
    },
    {
      say: `Then name files from your project that show what you have so far. Here: ${ex.files}. Without them, Claude has only your one sentence.`,
      do: [{ field: "card", key: "You type", value: `/reframe ${ex.desc}. Read ${ex.files}` }]
    },
    {
      say: `Claude reads the files and sees ${ex.sees}. Now the words it picks fit your project, not a guess.`,
      do: [{ token: "flow", at: "read" }]
    }
  ];

  const finish = (ex) => [
    {
      say: `Next, Claude gives you 8 to 12 expert words, most useful first, each explained in plain English. For example, ${ex.eg.term}`,
      do: [
        { token: "flow", at: "terms" },
        { field: "card", key: "Terms", value: ex.terms }
      ]
    },
    {
      say: `For each word, Claude finds a real project or paper that uses it, opens the link and checks. It drops any it can't confirm. For example, ${ex.eg.verify}`,
      do: [
        { token: "flow", at: "verify" },
        { field: "card", key: "Terms", value: `${ex.terms} ✓ checked` }
      ]
    },
    {
      say: `Then it looks at 2 or 3 other fields that solved the same problem under other names, and says where the match fails. For example, ${ex.eg.borrow}`,
      do: [
        { token: "flow", at: "borrow" },
        { field: "card", key: "Borrowed", value: ex.borrowed }
      ]
    },
    {
      say: `It tells you what you left out but should care about. For example, ${ex.eg.gap}`,
      do: [{ field: "card", key: "Gaps", value: ex.gaps }]
    },
    {
      say: "Last, it rewrites your request with the new words. Compare 'Before' and 'After' on the card.",
      do: [
        { token: "flow", at: "rewrite" },
        { field: "card", key: "After", value: ex.after },
        { status: "card", value: "Reframed", tone: "good" }
      ]
    },
    {
      say: `Use the new request as your next prompt. For example, ${ex.eg.use}`,
      do: [{ token: "flow", at: "use" }]
    }
  ];

  const clear = {
    before: "A skill that animates how things work",
    desc: "I want a skill that animates how things work, step by step",
    files: ".claude/skills/visualize/SKILL.md and specs/binary-search.js",
    sees: "you already have a player with Back, Play and Next, captions and scene types",
    terms: "storyboard · object constancy · narrative viz",
    borrowed: "Data journalism · film · debuggers",
    gaps: "Predict-the-next-step · reduced motion",
    after: "Storyboard first, then a declarative spec the player replays; elements keep object constancy",
    eg: {
      term: "'object constancy': a box keeps the same identity when it moves, so your eye can follow it.",
      verify: "it opens Mike Bostock's 'Object Constancy' article to check the word means what Claude says.",
      borrow: "film storyboards draw one frame per moment, like your steps. But a film has no Back button.",
      gap: "you never said if the viewer should guess the next step before they see it.",
      use: "type: /visualize binary search, storyboard first, with object constancy for the pointers."
    }
  };

  const ambiguous = {
    before: "Show how stuff changes over time",
    desc: "Show how stuff changes over time",
    files: "specs/motor-insurance-quote.js",
    sees: "a quote that moves Draft → Pricing → Quoted, and can branch to refer or decline",
    terms: "state · transition · guard · event",
    borrowed: "Game AI · UI routing · protocols",
    gaps: "Invalid transitions · history states",
    after: "Show a state machine: states, events that trigger transitions, and guards that block them",
    eg: {
      term: "'guard': a check that blocks a move, like 'no price until the rules pass'.",
      verify: "it would open the docs of a state-machine library and check they use 'guard' the same way.",
      borrow: "game AI, where an enemy switches between patrol, chase and attack.",
      gap: "what happens when an event comes in a state that can't handle it, like 'buy' on a declined quote?",
      use: "type: /visualize the insurance quote as a state machine, with a guard on each move."
    }
  };

  window.VIZ = {
    title: "How to use /reframe",
    subtitle: "pstack skill by Lauren Tan (poteto) · installed globally at ~/.claude/skills/reframe",
    scene: {
      flow: {
        type: "flow",
        token: "idea",
        lanes: ["You", "Claude", "Checks"],
        nodes: {
          idea:    { lane: "You",     label: "Fuzzy idea" },
          type:    { lane: "You",     label: "Type /reframe + files" },
          read:    { lane: "Claude",  label: "Read your files" },
          which:   { lane: "Claude",  label: "One problem?", shape: "decision" },
          pick:    { lane: "Checks",  label: "List & pick likeliest", tone: "warn" },
          terms:   { lane: "Claude",  label: "8–12 ranked terms" },
          verify:  { lane: "Checks",  label: "Open every link" },
          borrow:  { lane: "Claude",  label: "Neighbours & gaps" },
          rewrite: { lane: "Claude",  label: "Rewrite your request" },
          use:     { lane: "You",     label: "/visualize or a skill", tone: "good" }
        },
        edges: [
          ["idea", "type"],
          ["type", "read"],
          ["read", "which"],
          ["which", "terms", "yes"],
          ["which", "pick", "several"],
          ["pick", "terms"],
          ["terms", "verify"],
          ["verify", "borrow"],
          ["borrow", "rewrite"],
          ["rewrite", "use"]
        ]
      },
      card: { type: "card", title: "Your request" }
    },

    scenarios: [
      {
        name: "Clear problem",
        steps: [
          ...start(clear),
          {
            say: "Could your words mean more than one problem? Here they mean one: step-by-step explainers. So Claude goes straight to the words.",
            do: [{ token: "flow", at: "which" }]
          },
          ...finish(clear)
        ]
      },
      {
        name: "Ambiguous idea",
        steps: [
          ...start(ambiguous),
          {
            say: "'Changes over time' could mean several things. Claude checks before it guesses.",
            do: [{ token: "flow", at: "which" }]
          },
          {
            say: "It lists what you might mean: an algorithm animation, a time-series chart, or a state machine. It says how to tell them apart, then picks one and says why.",
            do: [
              { token: "flow", at: "pick" },
              { field: "card", key: "Could be", value: "Animation · time series · state machine" },
              { field: "card", key: "Picked", value: "State machine (your file has states)" }
            ]
          },
          ...finish(ambiguous)
        ]
      }
    ]
  };
})();
