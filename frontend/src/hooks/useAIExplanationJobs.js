import { useEffect, useRef, useState } from "react";
import { createAIExplanation, waitForAIJob } from "../api/aiJobs";
import { useLanguage } from "../i18n/LanguageContext";

export function useAIExplanationJobs() {
  const { language, t } = useLanguage();
  const [feedbackByQuestion, setFeedbackByQuestion] = useState({});
  const requestControllersRef = useRef(new Map());

  useEffect(() => () => {
    requestControllersRef.current.forEach((controller) => controller.abort());
    requestControllersRef.current.clear();
  }, []);

  const requestExplanation = async (question) => {
    const questionNumber = question.questionNumber;
    if (requestControllersRef.current.has(questionNumber)) return;

    const controller = new AbortController();
    requestControllersRef.current.set(questionNumber, controller);
    setFeedbackByQuestion((currentFeedback) => ({
      ...currentFeedback,
      [questionNumber]: { status: "PENDING", result: null, error: "" },
    }));

    try {
      const options = Object.fromEntries(
        (question.answers || []).map((answer) => [answer.label, answer.content]),
      );
      const createdJob = await createAIExplanation({
        question: question.question,
        options,
        correctAnswer: question.correctAnswer,
        userAnswer: question.selectedAnswer || "UNANSWERED",
        locale: language,
      }, { signal: controller.signal });

      setFeedbackByQuestion((currentFeedback) => ({
        ...currentFeedback,
        [questionNumber]: {
          ...currentFeedback[questionNumber],
          jobId: createdJob.jobId,
        },
      }));

      const completedJob = await waitForAIJob(createdJob.jobId, {
        signal: controller.signal,
      });

      if (completedJob.status === "FAILED") {
        throw new Error(completedJob.error || t("aiFeedbackError"));
      }

      setFeedbackByQuestion((currentFeedback) => ({
        ...currentFeedback,
        [questionNumber]: {
          status: "SUCCEEDED",
          jobId: completedJob.jobId,
          result: completedJob.result,
          error: "",
        },
      }));
    } catch (requestError) {
      if (requestError.name === "AbortError") return;
      setFeedbackByQuestion((currentFeedback) => ({
        ...currentFeedback,
        [questionNumber]: {
          status: "FAILED",
          result: null,
          error: requestError.code === "AI_JOB_TIMEOUT"
            ? t("aiFeedbackTimeout")
            : requestError.message || t("aiFeedbackError"),
        },
      }));
    } finally {
      requestControllersRef.current.delete(questionNumber);
    }
  };

  return { feedbackByQuestion, requestExplanation };
}
