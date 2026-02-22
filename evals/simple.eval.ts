import { evalite } from "evalite";
import { exactMatch } from "evalite/scorers";

evalite("Simple Eval", {
  data: [{ input: "Hello", expected: "Hello World!" }],
  task: async (input) => input + " World!",
  scorers: [
    {
      scorer: ({ output, expected }) => exactMatch({ actual: output, expected }),
    },
  ],
});
