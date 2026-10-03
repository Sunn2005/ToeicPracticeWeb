import { useEffect, useState } from "react";
import { loadPracticePart, startPracticeAttempt } from "../api/practice";
import { useAuth } from "../auth/useAuth";
import LanguageSwitcher from "../components/LanguageSwitcher";
import LoadingScreen from "../components/LoadingScreen";
import { useLanguage } from "../i18n/LanguageContext";

function PracticePart() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [part, setPart] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  const [attemptId, setAttemptId] = useState(null);
  const [startingAttempt, setStartingAttempt] = useState(false);

  useEffect(() => {
    loadPracticePart("test_001", "part5")
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
      if (!user) {
        alert(t("signInBeforeTest"));
        return;
      }

      setStartingAttempt(true);

      const data = await startPracticeAttempt("test_001");

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
    return <LoadingScreen message={t("loading")} />;
  }

  if (!part) {
    return <p>{t("noDataAvailable")}</p>;
  }

  return (
    <div style={{ maxWidth: "800px", margin: "40px auto" }}>
      <LanguageSwitcher className="mb-6" />
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
          {startingAttempt ? t("starting") : t("startTest")}
        </button>
      )}

      {attemptId && (
        <>
          <p>{t("attemptStarted")}</p>

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
                {t("question")} {question.number}: {question.content}
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
            {t("submit")}
          </button>
        </>
      )}
    </div>
  );
}

export default PracticePart;
