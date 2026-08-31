import TestCard from "./TestCard";

function TestList({ tests, attempts, onSelectTest, onOpenHistory }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {tests.map((test) => (
        <TestCard
          key={test.id}
          test={test}
          attempts={attempts.filter((attempt) => attempt.testId === test.id)}
          onSelect={onSelectTest}
          onOpenHistory={onOpenHistory}
        />
      ))}
    </div>
  );
}

export default TestList;
