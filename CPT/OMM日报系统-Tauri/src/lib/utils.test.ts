import { parseManualDuration, validateRealManualTask, recognizeManualTaskFromFolder } from "./utils";

console.log("=== parseManualDuration ===");
const tests = [
  ["1.5H", 90],
  ["1.5h", 90],
  ["1小时30分钟", 90],
  ["1小时", 60],
  ["90分钟", 90],
  ["1:30", 90],
  ["01:30", 90],
  ["90", 90],
  ["", null],
  ["abc", null],
] as const;
for (const [inp, expected] of tests) {
  const got = parseManualDuration(inp);
  console.log(got === expected ? "OK" : "FAIL", `"${inp}" -> ${got}`);
}

console.log("\n=== validateRealManualTask ===");
console.log(
  validateRealManualTask({
    product: "565",
    sender: "安睿克",
    send_date: "6月28日",
    quantity: "96PCS",
    duration_minutes: 90,
    operator: "卫阳",
  })
);
console.log(
  validateRealManualTask({
    product: "",
    sender: "",
    send_date: "",
    quantity: "",
    duration_minutes: 300,
    operator: "",
  })
);

console.log("\n=== recognizeManualTaskFromFolder ===");
console.log(recognizeManualTaskFromFolder("6.28-565-手量-卫阳-96PCS"));
console.log(recognizeManualTaskFromFolder("6.28-565-OMM-禹欣"));
