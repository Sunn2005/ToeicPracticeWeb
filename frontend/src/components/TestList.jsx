import TestCard from "./TestCard";

function TestList({ tests, onSelectTest }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {tests.map((test) => (
        <TestCard key={test.id} test={test} onSelect={onSelectTest} />
      ))}
    </div>
  );
}

export default TestList;
