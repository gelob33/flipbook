// A mind map of this project: what you can draw, what draws it, and the rules behind it.
window.VIZ = {
  title: "visual show me, as a mind map",
  subtitle: "What it draws, how, and the rules behind it",
  scene: {
    map: {
      type: "mindmap",
      outline: `
- visual show me
  - Diagrams
    - State machine
    - Process (BPMN)
    - Flow chart
    - Sequence diagram
    - Mind map
  - Scene types
    - flow
    - sequence
    - mindmap
    - array
    - card
    - waterfall
  - Player
    - Back / Play / Next
    - Scenarios
    - Levels
  - Skills
    - /visualize
    - /reframe
  - Writing rules
    - Storyboard first
    - Examples always
    - Orwell's six rules
    - 15 steps at most
  - Planned
    - Guess first
    - Swap boxes
    - Automatic levels`,
      notes: {
        "visual show me": "A local app that turns a process, an idea or an algorithm into a cartoon you step through with Back, Play and Next. Each visualisation is one data file; the player draws it.",
        "Diagrams": "The kinds of picture you can ask for. Pick by the question you want answered: what state is it in, who does what, who talks to whom, or how do ideas connect.",
        "State machine": "Answers 'what state is it in now?'. E.g. an order moves Cart → Paying → Paid; a tag shows the current state.",
        "Process (BPMN)": "Answers 'who does what, in what order?'. Lanes are people or systems; boxes are tasks, named with verbs, e.g. 'Send card details'.",
        "Flow chart": "Steps and yes/no decisions, e.g. 'Valid?' → yes: save, no: back to the form. Drawn by the same flow type as state machines.",
        "Sequence diagram": "Answers 'who sends what to whom?'. Columns are people or systems; arrows are messages, top to bottom in time order. Dashed arrows are replies.",
        "Mind map": "Answers 'how do these ideas fit together?'. Branches group ideas; dashed links tie ideas on different branches. You're looking at one.",
        "Scene types": "The code that draws things: one file each in runtime/types/. A visualisation can use several at once, e.g. a flow on the stage and a card beside it.",
        "flow": "Boxes, arrows, lanes and a moving tag. Handles loops, self-loops and decisions, and can link a box to a lower-level diagram.",
        "sequence": "Columns with lifelines and numbered message arrows. Each new arrow draws itself from sender to receiver.",
        "mindmap": "This type. Grows branch by branch; ideas can be folded, clicked for notes, and linked across branches.",
        "array": "A row of cells with pointers, for algorithms on a list, e.g. binary search.",
        "card": "A record that fills in field by field, e.g. a quote collecting the driver, the car and the price.",
        "waterfall": "A number built up from parts, e.g. a price: base rate, discounts, then tax.",
        "Player": "The page that plays any visualisation. It knows nothing about orders or payments: everything specific lives in the spec.",
        "Back / Play / Next": "Step through at your own pace, or press Play. Keys: ← → to step, space to play.",
        "Scenarios": "Different paths through the same diagram, e.g. 'approved' and 'declined'. They share their opening steps.",
        "Levels": "A box can open a more detailed diagram below it, e.g. the 'Paying' state opens the payment process. A breadcrumb takes you back.",
        "Skills": "Instructions Claude follows. They turn a request like 'show me how payments work' into a finished visualisation.",
        "/visualize": "Plans the steps, picks the diagram (or asks when it's a close call), writes the spec and checks it in a real browser.",
        "/reframe": "From pstack by Lauren Tan. Teaches the expert words for what you want, so you can ask for it precisely.",
        "Writing rules": "How captions are written, so a newcomer can follow every step.",
        "Storyboard first": "Before any spec, a table: one row per step, what changes on screen, and the caption. Fixing the story there is cheap.",
        "Examples always": "Every caption gives a real example: the command to type, a value, a file. No vague 'your files'.",
        "Orwell's six rules": "Short words, no stock phrases, cut needless words, active voice, everyday words over jargon, and break a rule rather than write something ugly.",
        "15 steps at most": "Past 15 steps people lose the thread. Long stories are split into levels, or repeats are summed up in one step.",
        "Planned": "Ideas not built yet. They live in docs/feature-map.md.",
        "Guess first": "A step asks 'what happens next?' and waits for the viewer to guess before showing the answer.",
        "Swap boxes": "In sorting, two boxes slide past each other instead of their numbers changing, so you can follow a value.",
        "Automatic levels": "One Back/Next that steps into a lower level and back out, instead of clicking a box to open it."
      }
    }
  },
  steps: [
    {
      say: "A mind map starts with one idea in the middle: here, this project. Everything else will branch out from it.",
      do: [{ focus: "map", at: "visual show me" }]
    },
    {
      say: "First branch: the diagrams you can make. Five kinds, e.g. a state machine for 'what state is the order in?' and a sequence diagram for 'who sends what to whom?'.",
      do: [{ grow: "map", at: "Diagrams", deep: true }]
    },
    {
      say: "Second branch: the scene types, the code that draws them. There are six; each is one file in runtime/types/.",
      do: [{ grow: "map", at: "Scene types", deep: true }]
    },
    {
      say: "Now the part mind maps are good at: tying ideas together across branches. Three of the five diagrams are drawn by one scene type, flow.",
      do: [
        { link: "map", from: "State machine", to: "flow" },
        { link: "map", from: "Process (BPMN)", to: "flow" },
        { link: "map", from: "Flow chart", to: "flow" },
        { focus: "map", at: "flow" }
      ]
    },
    {
      say: "The other two each have their own type: sequence draws sequence diagrams, and mindmap draws this one.",
      do: [
        { link: "map", from: "Sequence diagram", to: "sequence" },
        { link: "map", from: "Mind map", to: "mindmap" },
        { focus: "map", at: "mindmap" }
      ]
    },
    {
      say: "The player plays any of them the same way: Back, Play and Next, scenarios for different paths, and levels, where a box opens the diagram below it.",
      do: [{ grow: "map", at: "Player", deep: true }]
    },
    {
      say: "Two skills drive it. /visualize writes the visualisation; /reframe finds the right words first, when you know what you want but not what it's called.",
      do: [{ grow: "map", at: "Skills", deep: true }]
    },
    {
      say: "The rules /visualize follows, e.g. plan every step in a table before writing anything, and give a real example in every caption.",
      do: [
        { grow: "map", at: "Writing rules", deep: true },
        { link: "map", from: "/visualize", to: "Storyboard first", label: "follows" }
      ]
    },
    {
      say: "Last branch: what's planned. Automatic levels would grow out of today's clickable levels, so the two are linked.",
      do: [
        { grow: "map", at: "Planned", deep: true },
        { link: "map", from: "Levels", to: "Automatic levels", label: "leads to" }
      ]
    },
    {
      say: "The whole project on one page. The branches group ideas; the dashed links show how ideas in different groups connect.",
      do: [{ focus: "map", at: null }]
    }
  ]
};
