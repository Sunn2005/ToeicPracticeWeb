import { useEffect, useState } from "react";
import { auth } from "../firebase";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? "http://localhost:8080"
    : "https://toeicpracticeweb.onrender.com");

function PracticePart() {
  const [part, setPart] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  const [attemptId, setAttemptId] = useState(null);
  const [startingAttempt, setStartingAttempt] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/tests/test_001/parts/part5`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load data");
        }

        return response.json();
      })
      .then((data) => {
        setPart(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, []);

  const startAttempt = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        alert("Please sign in before starting a test.");
        return;
      }

      setStartingAttempt(true);

      // getIdToken() trả về Firebase ID token. Tham số true buộc Firebase
      // refresh token để backend không nhận lại token cũ trong cache.
      const idToken = await auth.currentUser.getIdToken(true);

      const response = await fetch(`${API_BASE_URL}/api/attempts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          testId: "test_001",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        console.error("Backend error:", errorText);

        throw new Error(
          `Unable to create attempt - Status ${response.status}: ${errorText}`,
        );
      }

      const data = await response.json();

      console.log("Attempt:", data);

      setAttemptId(data.id);
    } catch (error) {
      console.error("Unable to create attempt:", error);
      alert(error.message);
    } finally {
      setStartingAttempt(false);
    }
  };

  const selectAnswer = (questionNumber, answer) => {
    setAnswers((prev) => ({
      ...prev,
      [questionNumber]: answer,
    }));
  };

  const submitExam = () => {
    console.log("Attempt ID:", attemptId);
    console.log("Answers:", answers);
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!part) {
    return <p>No data available.</p>;
  }

  return (
    <div style={{ maxWidth: "800px", margin: "40px auto" }}>
      <h1>
        Part {part.partNumber}: {part.title}
      </h1>

      {!attemptId && (
        <button
          onClick={startAttempt}
          disabled={startingAttempt}
          style={{
            padding: "10px 20px",
            cursor: "pointer",
            marginBottom: "30px",
          }}
        >
          {startingAttempt ? "Starting..." : "Start test"}
        </button>
      )}

      {attemptId && (
        <>
          <p>Your attempt has started.</p>

          {part.questions.map((question) => (
            <div
              key={question.number}
              style={{
                marginBottom: "30px",
                padding: "20px",
                border: "1px solid #ddd",
                borderRadius: "8px",
              }}
            >
              <h3>
                Question {question.number}: {question.content}
              </h3>

              {question.options.map((option) => (
                <label
                  key={option.key}
                  style={{
                    display: "block",
                    margin: "10px 0",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name={`question-${question.number}`}
                    value={option.key}
                    checked={answers[question.number] === option.key}
                    onChange={() => selectAnswer(question.number, option.key)}
                  />{" "}
                  {option.key}. {option.text}
                </label>
              ))}
            </div>
          ))}

          <button
            onClick={submitExam}
            style={{
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Submit
          </button>
        </>
      )}
    </div>
  );
}

export default PracticePart;
