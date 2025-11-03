import { END, START, StateGraph } from "@langchain/langgraph";

type State = {
  graph_state: string;
};

function node_1(state: State): Partial<State> {
  console.log("---Node 1---");
  return { graph_state: `${state.graph_state} I am` };
}

function node_2(state: State): Partial<State> {
  console.log("---Node 2---");
  return { graph_state: `${state.graph_state} happy!` };
}

function node_3(state: State): Partial<State> {
  console.log("---Node 3---");
  return { graph_state: `${state.graph_state} sad!` };
}

type NextNode = "node_2" | "node_3";

function decide_mood(state: State): NextNode {
  // La décision pourrait utiliser l'état; ici on fait un split 50/50
  const _userInput = state.graph_state;
  return Math.random() < 0.5 ? "node_2" : "node_3";
}

const builder = new StateGraph<State>({
  channels: {
    graph_state: {
      default: () => "",
      reducer: (current: string, update: string) => update,
    },
  },
});

builder.addNode("node_1", node_1);
builder.addNode("node_2", node_2);
builder.addNode("node_3", node_3);

builder.addEdge(START as any, "node_1" as any);
builder.addConditionalEdges("node_1" as any, decide_mood as any);
builder.addEdge("node_2" as any, END as any);
builder.addEdge("node_3" as any, END as any);

export const graph = builder.compile();


graph.invoke({ graph_state: "Hi, this is Lance." }).then(console.log);