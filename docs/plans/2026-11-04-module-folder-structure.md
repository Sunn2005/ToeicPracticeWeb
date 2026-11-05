# FE/BE folder restructuring — 2026-11-04

## Scope and invariants

Organize frontend features under `src/modules/`; keep backend MVC layers at the
top level and organize business packages inside each layer. This is a file and
reference migration only: preserve JavaScript/Java behavior, route URLs, API
contracts, authorization, Firestore paths and fields, exam timing/scoring/autosave,
AI state machines, and RabbitMQ configuration. No dependencies are added.

Keep FE `App.jsx`, `main.jsx`, auth infrastructure, Firebase configuration, API
client, global CSS, assets, layouts, and translations at their existing paths.
Keep BE `BackendApplication`, config, security, resources, and every existing
`com.toeic.dto.ai` class at their existing paths/packages. The latter preserves
message type identities, including queued deliveries; no AI-service changes.
`PayOSClient` stays beside billing services because existing tests use its
package-private signing helpers. Keep those helpers' visibility unchanged.
Existing nested gateway implementations move with their interfaces, without
splitting or redesigning them. Keep `ReviewFieldNormalizer` and its callers in
the same package. Place tests with the packages/classes they exercise.

The pre-existing deletion of `docs/HUONG_DAN_USE_CASE_TU_BUOC_4.md` is outside
this change. Work on `codex/module-folder-structure`; do not commit or push.
The user has authorized the cross-owner file moves and reference updates in
this chat; existing ownership/locked status must follow the files, not disappear.

## Plan

1. Inspect contracts, dependencies, package visibility, test paths and messaging.
2. Run FE lint/tests/build and BE tests before moving files; record the baseline.
3. Move FE files using the map below and update only module/file references,
   including source-reading tests and the explicit npm test file list.
4. Move BE packages and tests; update fully qualified names and explicit imports
   for formerly implicit same-package references. Preserve access modifiers.
5. Update current FE ownership documentation and add BE structure documentation.
   Preserve historical design records and API/AI contracts.
6. Verify migration coverage, local imports, unchanged source bodies, stable
   message DTOs, and unchanged resources/configuration. Run FE lint/tests/build
   and a fresh BE compile/test. Compare test counts and test names to baseline.
7. Review the mapped before/after diff and git status. Report limits of local
   verification; external Firebase/PayOS/RabbitMQ workflows require live services.

## Baseline

- FE: lint passes, 124 tests pass, production build passes (existing chunk-size warning).
- BE: 323 tests pass, zero failures/errors/skips.

## Package visibility exception found during clean compilation

`FirestoreUserDao`, `FirestoreStaffStore`, and the package-private
`FirestoreUserMapper` remain together in `com.toeic.dao.firestore`, along with
the mapper/user DAO tests. Both stores use the same user document mapping;
preserve this access boundary instead of making classes or methods public.
Their interfaces still belong to `dao.user` and `dao.staff` respectively.

## Verification result

- Moved 119 FE files and 145 BE files, including their existing tests.
- Compared all 138 FE JS/JSX files and 176 BE Java files against the pre-move
  snapshots. After resolving old/new module references and package/class names,
  source bodies and dependency targets are unchanged. No access modifiers changed.
- FE lint passes; the same 124 default tests pass. The six existing profile API
  tests, which are not listed in the existing npm test command, also pass when
  run separately. The npm test command only changes paths, not test selection.
- FE production build passes. All four emitted asset paths/hashes and reported
  sizes match the baseline. The pre-existing chunk-size warning remains.
- BE `./mvnw clean test` passes: the same 323 test identities, zero
  failures/errors/skips, including Spring context and security tests.
- Existing RabbitMQ message DTO sources and their fully qualified class names
  are unchanged. The HTTP `AIExplanationResultDto` keeps its package and only
  updates a reference to the relocated `AIExplanationResult` model.
- API/AI contract documents, backend resources, AI service, dependency versions,
  lockfiles, environment files, Firestore paths and messaging configuration
  remain unchanged. Current FE ownership paths follow the moved files.
- No deployment or external Firebase/PayOS/RabbitMQ end-to-end transaction was
  performed. Local tests and source equivalence are the verification boundary.

## Exact move map

Paths below are repository-relative. Files not listed stay in place; some need
import/reference updates because they use moved files.

| Before | After |
| --- | --- |
| `backend/src/main/java/com/toeic/controller/AIChatController.java` | `backend/src/main/java/com/toeic/controller/ai/chat/AIChatController.java` |
| `backend/src/main/java/com/toeic/controller/AIJobController.java` | `backend/src/main/java/com/toeic/controller/ai/job/AIJobController.java` |
| `backend/src/main/java/com/toeic/controller/AITestController.java` | `backend/src/main/java/com/toeic/controller/ai/job/AITestController.java` |
| `backend/src/main/java/com/toeic/controller/AdminPaymentController.java` | `backend/src/main/java/com/toeic/controller/billing/AdminPaymentController.java` |
| `backend/src/main/java/com/toeic/controller/AdminReviewController.java` | `backend/src/main/java/com/toeic/controller/test/AdminReviewController.java` |
| `backend/src/main/java/com/toeic/controller/ApiCodeException.java` | `backend/src/main/java/com/toeic/exception/ApiCodeException.java` |
| `backend/src/main/java/com/toeic/controller/ApiExceptionHandler.java` | `backend/src/main/java/com/toeic/exception/ApiExceptionHandler.java` |
| `backend/src/main/java/com/toeic/controller/AttemptController.java` | `backend/src/main/java/com/toeic/controller/attempt/AttemptController.java` |
| `backend/src/main/java/com/toeic/controller/AuthenticationController.java` | `backend/src/main/java/com/toeic/controller/auth/AuthenticationController.java` |
| `backend/src/main/java/com/toeic/controller/EmployeeTestController.java` | `backend/src/main/java/com/toeic/controller/test/EmployeeTestController.java` |
| `backend/src/main/java/com/toeic/controller/HealthController.java` | `backend/src/main/java/com/toeic/controller/health/HealthController.java` |
| `backend/src/main/java/com/toeic/controller/MeController.java` | `backend/src/main/java/com/toeic/controller/user/MeController.java` |
| `backend/src/main/java/com/toeic/controller/PaymentController.java` | `backend/src/main/java/com/toeic/controller/billing/PaymentController.java` |
| `backend/src/main/java/com/toeic/controller/StaffManagementController.java` | `backend/src/main/java/com/toeic/controller/staff/StaffManagementController.java` |
| `backend/src/main/java/com/toeic/controller/StaffPasswordController.java` | `backend/src/main/java/com/toeic/controller/staff/StaffPasswordController.java` |
| `backend/src/main/java/com/toeic/controller/TestController.java` | `backend/src/main/java/com/toeic/controller/test/TestController.java` |
| `backend/src/main/java/com/toeic/controller/UserController.java` | `backend/src/main/java/com/toeic/controller/user/UserController.java` |
| `backend/src/main/java/com/toeic/dao/AIAnalysisDao.java` | `backend/src/main/java/com/toeic/dao/ai/analysis/AIAnalysisDao.java` |
| `backend/src/main/java/com/toeic/dao/AIChatDao.java` | `backend/src/main/java/com/toeic/dao/ai/chat/AIChatDao.java` |
| `backend/src/main/java/com/toeic/dao/AIJobDao.java` | `backend/src/main/java/com/toeic/dao/ai/job/AIJobDao.java` |
| `backend/src/main/java/com/toeic/dao/AttemptDao.java` | `backend/src/main/java/com/toeic/dao/attempt/AttemptDao.java` |
| `backend/src/main/java/com/toeic/dao/PaymentOrderDao.java` | `backend/src/main/java/com/toeic/dao/billing/PaymentOrderDao.java` |
| `backend/src/main/java/com/toeic/dao/StaffStore.java` | `backend/src/main/java/com/toeic/dao/staff/StaffStore.java` |
| `backend/src/main/java/com/toeic/dao/SubscriptionDao.java` | `backend/src/main/java/com/toeic/dao/billing/SubscriptionDao.java` |
| `backend/src/main/java/com/toeic/dao/TestDao.java` | `backend/src/main/java/com/toeic/dao/test/TestDao.java` |
| `backend/src/main/java/com/toeic/dao/UserDao.java` | `backend/src/main/java/com/toeic/dao/user/UserDao.java` |
| `backend/src/main/java/com/toeic/dao/firestore/FirestoreAIAnalysisDao.java` | `backend/src/main/java/com/toeic/dao/ai/analysis/firestore/FirestoreAIAnalysisDao.java` |
| `backend/src/main/java/com/toeic/dao/firestore/FirestoreAIChatDao.java` | `backend/src/main/java/com/toeic/dao/ai/chat/firestore/FirestoreAIChatDao.java` |
| `backend/src/main/java/com/toeic/dao/firestore/FirestoreAIJobDao.java` | `backend/src/main/java/com/toeic/dao/ai/job/firestore/FirestoreAIJobDao.java` |
| `backend/src/main/java/com/toeic/dao/firestore/FirestoreAttemptDao.java` | `backend/src/main/java/com/toeic/dao/attempt/firestore/FirestoreAttemptDao.java` |
| `backend/src/main/java/com/toeic/dao/firestore/FirestorePaymentOrderDao.java` | `backend/src/main/java/com/toeic/dao/billing/firestore/FirestorePaymentOrderDao.java` |
| `backend/src/main/java/com/toeic/dao/firestore/FirestoreSubscriptionDao.java` | `backend/src/main/java/com/toeic/dao/billing/firestore/FirestoreSubscriptionDao.java` |
| `backend/src/main/java/com/toeic/dao/firestore/FirestoreTestDao.java` | `backend/src/main/java/com/toeic/dao/test/firestore/FirestoreTestDao.java` |
| `backend/src/main/java/com/toeic/dto/ApiErrorResponse.java` | `backend/src/main/java/com/toeic/dto/common/ApiErrorResponse.java` |
| `backend/src/main/java/com/toeic/dto/AttemptResultDto.java` | `backend/src/main/java/com/toeic/dto/attempt/AttemptResultDto.java` |
| `backend/src/main/java/com/toeic/dto/CreateAttemptRequest.java` | `backend/src/main/java/com/toeic/dto/attempt/CreateAttemptRequest.java` |
| `backend/src/main/java/com/toeic/dto/CreateChatConversationRequest.java` | `backend/src/main/java/com/toeic/dto/ai/chat/CreateChatConversationRequest.java` |
| `backend/src/main/java/com/toeic/dto/CreateSessionRequest.java` | `backend/src/main/java/com/toeic/dto/auth/CreateSessionRequest.java` |
| `backend/src/main/java/com/toeic/dto/RejectTestRequest.java` | `backend/src/main/java/com/toeic/dto/test/RejectTestRequest.java` |
| `backend/src/main/java/com/toeic/dto/RenameChatConversationRequest.java` | `backend/src/main/java/com/toeic/dto/ai/chat/RenameChatConversationRequest.java` |
| `backend/src/main/java/com/toeic/dto/SaveAnswerRequest.java` | `backend/src/main/java/com/toeic/dto/attempt/SaveAnswerRequest.java` |
| `backend/src/main/java/com/toeic/dto/SendChatMessageRequest.java` | `backend/src/main/java/com/toeic/dto/ai/chat/SendChatMessageRequest.java` |
| `backend/src/main/java/com/toeic/dto/UpdatePositionRequest.java` | `backend/src/main/java/com/toeic/dto/attempt/UpdatePositionRequest.java` |
| `backend/src/main/java/com/toeic/dto/UpdateUserProfileRequest.java` | `backend/src/main/java/com/toeic/dto/user/UpdateUserProfileRequest.java` |
| `backend/src/main/java/com/toeic/messaging/AIChatResultConsumer.java` | `backend/src/main/java/com/toeic/messaging/ai/chat/AIChatResultConsumer.java` |
| `backend/src/main/java/com/toeic/messaging/AIResultConsumer.java` | `backend/src/main/java/com/toeic/messaging/ai/job/AIResultConsumer.java` |
| `backend/src/main/java/com/toeic/messaging/AIReviewResultConsumer.java` | `backend/src/main/java/com/toeic/messaging/ai/analysis/AIReviewResultConsumer.java` |
| `backend/src/main/java/com/toeic/model/AIChatConversation.java` | `backend/src/main/java/com/toeic/model/ai/chat/AIChatConversation.java` |
| `backend/src/main/java/com/toeic/model/AIChatJob.java` | `backend/src/main/java/com/toeic/model/ai/chat/AIChatJob.java` |
| `backend/src/main/java/com/toeic/model/AIChatMessage.java` | `backend/src/main/java/com/toeic/model/ai/chat/AIChatMessage.java` |
| `backend/src/main/java/com/toeic/model/AIChatQuota.java` | `backend/src/main/java/com/toeic/model/ai/chat/AIChatQuota.java` |
| `backend/src/main/java/com/toeic/model/AIExplanationResult.java` | `backend/src/main/java/com/toeic/model/ai/job/AIExplanationResult.java` |
| `backend/src/main/java/com/toeic/model/AIJob.java` | `backend/src/main/java/com/toeic/model/ai/job/AIJob.java` |
| `backend/src/main/java/com/toeic/model/AnswerOption.java` | `backend/src/main/java/com/toeic/model/test/AnswerOption.java` |
| `backend/src/main/java/com/toeic/model/Attempt.java` | `backend/src/main/java/com/toeic/model/attempt/Attempt.java` |
| `backend/src/main/java/com/toeic/model/AttemptAnswer.java` | `backend/src/main/java/com/toeic/model/attempt/AttemptAnswer.java` |
| `backend/src/main/java/com/toeic/model/AttemptResult.java` | `backend/src/main/java/com/toeic/model/attempt/AttemptResult.java` |
| `backend/src/main/java/com/toeic/model/FirebaseIdentity.java` | `backend/src/main/java/com/toeic/model/auth/FirebaseIdentity.java` |
| `backend/src/main/java/com/toeic/model/Passage.java` | `backend/src/main/java/com/toeic/model/test/Passage.java` |
| `backend/src/main/java/com/toeic/model/PassageGroup.java` | `backend/src/main/java/com/toeic/model/test/PassageGroup.java` |
| `backend/src/main/java/com/toeic/model/PaymentOrder.java` | `backend/src/main/java/com/toeic/model/billing/PaymentOrder.java` |
| `backend/src/main/java/com/toeic/model/Question.java` | `backend/src/main/java/com/toeic/model/test/Question.java` |
| `backend/src/main/java/com/toeic/model/QuestionGroup.java` | `backend/src/main/java/com/toeic/model/test/QuestionGroup.java` |
| `backend/src/main/java/com/toeic/model/StaffGroup.java` | `backend/src/main/java/com/toeic/model/staff/StaffGroup.java` |
| `backend/src/main/java/com/toeic/model/Subscription.java` | `backend/src/main/java/com/toeic/model/billing/Subscription.java` |
| `backend/src/main/java/com/toeic/model/Test.java` | `backend/src/main/java/com/toeic/model/test/Test.java` |
| `backend/src/main/java/com/toeic/model/TestPart.java` | `backend/src/main/java/com/toeic/model/test/TestPart.java` |
| `backend/src/main/java/com/toeic/model/User.java` | `backend/src/main/java/com/toeic/model/user/User.java` |
| `backend/src/main/java/com/toeic/model/enums/AIAnalysisStatus.java` | `backend/src/main/java/com/toeic/model/ai/analysis/enums/AIAnalysisStatus.java` |
| `backend/src/main/java/com/toeic/model/enums/AttemptSection.java` | `backend/src/main/java/com/toeic/model/attempt/enums/AttemptSection.java` |
| `backend/src/main/java/com/toeic/model/enums/AttemptStatus.java` | `backend/src/main/java/com/toeic/model/attempt/enums/AttemptStatus.java` |
| `backend/src/main/java/com/toeic/model/enums/Entitlement.java` | `backend/src/main/java/com/toeic/model/billing/enums/Entitlement.java` |
| `backend/src/main/java/com/toeic/model/enums/ExamMode.java` | `backend/src/main/java/com/toeic/model/attempt/enums/ExamMode.java` |
| `backend/src/main/java/com/toeic/model/enums/PaymentOrderStatus.java` | `backend/src/main/java/com/toeic/model/billing/enums/PaymentOrderStatus.java` |
| `backend/src/main/java/com/toeic/model/enums/ProPlan.java` | `backend/src/main/java/com/toeic/model/billing/enums/ProPlan.java` |
| `backend/src/main/java/com/toeic/model/enums/SubscriptionStatus.java` | `backend/src/main/java/com/toeic/model/billing/enums/SubscriptionStatus.java` |
| `backend/src/main/java/com/toeic/model/enums/TestStatus.java` | `backend/src/main/java/com/toeic/model/test/enums/TestStatus.java` |
| `backend/src/main/java/com/toeic/model/enums/TestType.java` | `backend/src/main/java/com/toeic/model/test/enums/TestType.java` |
| `backend/src/main/java/com/toeic/model/enums/UserRole.java` | `backend/src/main/java/com/toeic/model/user/enums/UserRole.java` |
| `backend/src/main/java/com/toeic/service/AIChatRequestPublisher.java` | `backend/src/main/java/com/toeic/service/ai/chat/AIChatRequestPublisher.java` |
| `backend/src/main/java/com/toeic/service/AIChatResultService.java` | `backend/src/main/java/com/toeic/service/ai/chat/AIChatResultService.java` |
| `backend/src/main/java/com/toeic/service/AIChatService.java` | `backend/src/main/java/com/toeic/service/ai/chat/AIChatService.java` |
| `backend/src/main/java/com/toeic/service/AIJobService.java` | `backend/src/main/java/com/toeic/service/ai/job/AIJobService.java` |
| `backend/src/main/java/com/toeic/service/AIRequestPublisher.java` | `backend/src/main/java/com/toeic/service/ai/job/AIRequestPublisher.java` |
| `backend/src/main/java/com/toeic/service/AIReviewRequestPublisher.java` | `backend/src/main/java/com/toeic/service/ai/analysis/AIReviewRequestPublisher.java` |
| `backend/src/main/java/com/toeic/service/AIReviewService.java` | `backend/src/main/java/com/toeic/service/ai/analysis/AIReviewService.java` |
| `backend/src/main/java/com/toeic/service/AdminPaymentService.java` | `backend/src/main/java/com/toeic/service/billing/AdminPaymentService.java` |
| `backend/src/main/java/com/toeic/service/AdminRevenueService.java` | `backend/src/main/java/com/toeic/service/billing/AdminRevenueService.java` |
| `backend/src/main/java/com/toeic/service/AdminReviewService.java` | `backend/src/main/java/com/toeic/service/test/AdminReviewService.java` |
| `backend/src/main/java/com/toeic/service/AttemptService.java` | `backend/src/main/java/com/toeic/service/attempt/AttemptService.java` |
| `backend/src/main/java/com/toeic/service/ChatAttemptContextService.java` | `backend/src/main/java/com/toeic/service/ai/chat/ChatAttemptContextService.java` |
| `backend/src/main/java/com/toeic/service/CurrentUserService.java` | `backend/src/main/java/com/toeic/service/user/CurrentUserService.java` |
| `backend/src/main/java/com/toeic/service/EmployeeTestService.java` | `backend/src/main/java/com/toeic/service/test/EmployeeTestService.java` |
| `backend/src/main/java/com/toeic/service/FirebaseAuthGateway.java` | `backend/src/main/java/com/toeic/integration/firebase/FirebaseAuthGateway.java` |
| `backend/src/main/java/com/toeic/service/FirebaseSessionService.java` | `backend/src/main/java/com/toeic/service/auth/FirebaseSessionService.java` |
| `backend/src/main/java/com/toeic/service/MediaStorageService.java` | `backend/src/main/java/com/toeic/service/media/MediaStorageService.java` |
| `backend/src/main/java/com/toeic/service/PayOSClient.java` | `backend/src/main/java/com/toeic/service/billing/PayOSClient.java` |
| `backend/src/main/java/com/toeic/service/PaymentService.java` | `backend/src/main/java/com/toeic/service/billing/PaymentService.java` |
| `backend/src/main/java/com/toeic/service/ReviewFieldNormalizer.java` | `backend/src/main/java/com/toeic/service/test/ReviewFieldNormalizer.java` |
| `backend/src/main/java/com/toeic/service/StaffAccessService.java` | `backend/src/main/java/com/toeic/service/staff/StaffAccessService.java` |
| `backend/src/main/java/com/toeic/service/StaffCredentialService.java` | `backend/src/main/java/com/toeic/service/staff/StaffCredentialService.java` |
| `backend/src/main/java/com/toeic/service/StaffIdentityGateway.java` | `backend/src/main/java/com/toeic/integration/firebase/StaffIdentityGateway.java` |
| `backend/src/main/java/com/toeic/service/StaffMailGateway.java` | `backend/src/main/java/com/toeic/integration/mail/StaffMailGateway.java` |
| `backend/src/main/java/com/toeic/service/StaffManagementService.java` | `backend/src/main/java/com/toeic/service/staff/StaffManagementService.java` |
| `backend/src/main/java/com/toeic/service/StaffPermissions.java` | `backend/src/main/java/com/toeic/service/staff/StaffPermissions.java` |
| `backend/src/main/java/com/toeic/service/StaffRecoveryLimiter.java` | `backend/src/main/java/com/toeic/service/staff/StaffRecoveryLimiter.java` |
| `backend/src/main/java/com/toeic/service/SubscriptionService.java` | `backend/src/main/java/com/toeic/service/billing/SubscriptionService.java` |
| `backend/src/main/java/com/toeic/service/TestManagementSupport.java` | `backend/src/main/java/com/toeic/service/test/TestManagementSupport.java` |
| `backend/src/main/java/com/toeic/service/TestService.java` | `backend/src/main/java/com/toeic/service/test/TestService.java` |
| `backend/src/main/java/com/toeic/service/ToeicScoreConverter.java` | `backend/src/main/java/com/toeic/service/attempt/ToeicScoreConverter.java` |
| `backend/src/main/java/com/toeic/service/UserLearningService.java` | `backend/src/main/java/com/toeic/service/user/UserLearningService.java` |
| `backend/src/test/java/com/toeic/controller/AIChatControllerTests.java` | `backend/src/test/java/com/toeic/controller/ai/chat/AIChatControllerTests.java` |
| `backend/src/test/java/com/toeic/controller/AdminPaymentControllerTests.java` | `backend/src/test/java/com/toeic/controller/billing/AdminPaymentControllerTests.java` |
| `backend/src/test/java/com/toeic/controller/ApiExceptionHandlerTests.java` | `backend/src/test/java/com/toeic/exception/ApiExceptionHandlerTests.java` |
| `backend/src/test/java/com/toeic/controller/AttemptControllerTests.java` | `backend/src/test/java/com/toeic/controller/attempt/AttemptControllerTests.java` |
| `backend/src/test/java/com/toeic/controller/AuthenticationControllerTests.java` | `backend/src/test/java/com/toeic/controller/auth/AuthenticationControllerTests.java` |
| `backend/src/test/java/com/toeic/controller/MeControllerTests.java` | `backend/src/test/java/com/toeic/controller/user/MeControllerTests.java` |
| `backend/src/test/java/com/toeic/dao/firestore/FirestoreAIChatDaoTests.java` | `backend/src/test/java/com/toeic/dao/ai/chat/firestore/FirestoreAIChatDaoTests.java` |
| `backend/src/test/java/com/toeic/dao/firestore/FirestoreAttemptDaoTests.java` | `backend/src/test/java/com/toeic/dao/attempt/firestore/FirestoreAttemptDaoTests.java` |
| `backend/src/test/java/com/toeic/dao/firestore/FirestoreSubscriptionDaoTests.java` | `backend/src/test/java/com/toeic/dao/billing/firestore/FirestoreSubscriptionDaoTests.java` |
| `backend/src/test/java/com/toeic/dao/firestore/FirestoreTestDaoTests.java` | `backend/src/test/java/com/toeic/dao/test/firestore/FirestoreTestDaoTests.java` |
| `backend/src/test/java/com/toeic/service/AIChatResultServiceTests.java` | `backend/src/test/java/com/toeic/service/ai/chat/AIChatResultServiceTests.java` |
| `backend/src/test/java/com/toeic/service/AIChatServiceTests.java` | `backend/src/test/java/com/toeic/service/ai/chat/AIChatServiceTests.java` |
| `backend/src/test/java/com/toeic/service/AIReviewServiceTests.java` | `backend/src/test/java/com/toeic/service/ai/analysis/AIReviewServiceTests.java` |
| `backend/src/test/java/com/toeic/service/AdminPaymentServiceTests.java` | `backend/src/test/java/com/toeic/service/billing/AdminPaymentServiceTests.java` |
| `backend/src/test/java/com/toeic/service/AdminRevenueServiceTests.java` | `backend/src/test/java/com/toeic/service/billing/AdminRevenueServiceTests.java` |
| `backend/src/test/java/com/toeic/service/AdminReviewServiceTests.java` | `backend/src/test/java/com/toeic/service/test/AdminReviewServiceTests.java` |
| `backend/src/test/java/com/toeic/service/AttemptServiceTests.java` | `backend/src/test/java/com/toeic/service/attempt/AttemptServiceTests.java` |
| `backend/src/test/java/com/toeic/service/ChatAttemptContextServiceTests.java` | `backend/src/test/java/com/toeic/service/ai/chat/ChatAttemptContextServiceTests.java` |
| `backend/src/test/java/com/toeic/service/CurrentUserServiceTests.java` | `backend/src/test/java/com/toeic/service/user/CurrentUserServiceTests.java` |
| `backend/src/test/java/com/toeic/service/EmployeeTestServiceTests.java` | `backend/src/test/java/com/toeic/service/test/EmployeeTestServiceTests.java` |
| `backend/src/test/java/com/toeic/service/FirebaseSessionServiceTests.java` | `backend/src/test/java/com/toeic/service/auth/FirebaseSessionServiceTests.java` |
| `backend/src/test/java/com/toeic/service/FirestoreStaffStoreTests.java` | `backend/src/test/java/com/toeic/service/staff/FirestoreStaffStoreTests.java` |
| `backend/src/test/java/com/toeic/service/MediaStorageServiceTests.java` | `backend/src/test/java/com/toeic/service/media/MediaStorageServiceTests.java` |
| `backend/src/test/java/com/toeic/service/PayOSClientTests.java` | `backend/src/test/java/com/toeic/service/billing/PayOSClientTests.java` |
| `backend/src/test/java/com/toeic/service/PaymentServiceTests.java` | `backend/src/test/java/com/toeic/service/billing/PaymentServiceTests.java` |
| `backend/src/test/java/com/toeic/service/ReviewFieldNormalizerTests.java` | `backend/src/test/java/com/toeic/service/test/ReviewFieldNormalizerTests.java` |
| `backend/src/test/java/com/toeic/service/StaffCredentialServiceTests.java` | `backend/src/test/java/com/toeic/service/staff/StaffCredentialServiceTests.java` |
| `backend/src/test/java/com/toeic/service/StaffManagementServiceTests.java` | `backend/src/test/java/com/toeic/service/staff/StaffManagementServiceTests.java` |
| `backend/src/test/java/com/toeic/service/SubscriptionConcurrencyTests.java` | `backend/src/test/java/com/toeic/service/billing/SubscriptionConcurrencyTests.java` |
| `backend/src/test/java/com/toeic/service/SubscriptionServiceTests.java` | `backend/src/test/java/com/toeic/service/billing/SubscriptionServiceTests.java` |
| `backend/src/test/java/com/toeic/service/TestManagementSupportTests.java` | `backend/src/test/java/com/toeic/service/test/TestManagementSupportTests.java` |
| `backend/src/test/java/com/toeic/service/TestServiceTests.java` | `backend/src/test/java/com/toeic/service/test/TestServiceTests.java` |
| `backend/src/test/java/com/toeic/service/ToeicScoreConverterTests.java` | `backend/src/test/java/com/toeic/service/attempt/ToeicScoreConverterTests.java` |
| `backend/src/test/java/com/toeic/service/UserLearningServiceTests.java` | `backend/src/test/java/com/toeic/service/user/UserLearningServiceTests.java` |
| `frontend/src/api/adminPayments.js` | `frontend/src/api/billing/adminPayments.js` |
| `frontend/src/api/adminPayments.test.js` | `frontend/src/api/billing/adminPayments.test.js` |
| `frontend/src/api/adminReviews.js` | `frontend/src/api/tests/adminReviews.js` |
| `frontend/src/api/adminStaff.js` | `frontend/src/api/staff/adminStaff.js` |
| `frontend/src/api/adminStaff.test.js` | `frontend/src/api/staff/adminStaff.test.js` |
| `frontend/src/api/aiAnalysis.js` | `frontend/src/api/ai/aiAnalysis.js` |
| `frontend/src/api/aiChat.js` | `frontend/src/api/ai/aiChat.js` |
| `frontend/src/api/aiChat.test.js` | `frontend/src/api/ai/aiChat.test.js` |
| `frontend/src/api/aiJobs.js` | `frontend/src/api/ai/aiJobs.js` |
| `frontend/src/api/auth.js` | `frontend/src/api/auth/auth.js` |
| `frontend/src/api/employeeTests.js` | `frontend/src/api/tests/employeeTests.js` |
| `frontend/src/api/payments.js` | `frontend/src/api/billing/payments.js` |
| `frontend/src/api/payments.test.js` | `frontend/src/api/billing/payments.test.js` |
| `frontend/src/api/practice.js` | `frontend/src/api/attempts/practice.js` |
| `frontend/src/api/practice.test.js` | `frontend/src/api/attempts/practice.test.js` |
| `frontend/src/api/publicTests.js` | `frontend/src/api/tests/publicTests.js` |
| `frontend/src/api/staffPasswords.js` | `frontend/src/api/staff/staffPasswords.js` |
| `frontend/src/api/staffPasswords.test.js` | `frontend/src/api/staff/staffPasswords.test.js` |
| `frontend/src/api/userLearning.js` | `frontend/src/api/users/userLearning.js` |
| `frontend/src/api/userLearningChatContext.test.js` | `frontend/src/api/users/userLearningChatContext.test.js` |
| `frontend/src/api/userLearningProfile.test.js` | `frontend/src/api/users/userLearningProfile.test.js` |
| `frontend/src/components/AIExplanationPanel.jsx` | `frontend/src/modules/ai-analysis/components/AIExplanationPanel.jsx` |
| `frontend/src/components/BrandLogo.jsx` | `frontend/src/components/ui/BrandLogo.jsx` |
| `frontend/src/components/ExamHeader.jsx` | `frontend/src/modules/exam/components/ExamHeader.jsx` |
| `frontend/src/components/ExamModeCard.jsx` | `frontend/src/modules/exam/components/ExamModeCard.jsx` |
| `frontend/src/components/ExamNavigationBar.jsx` | `frontend/src/modules/exam/components/ExamNavigationBar.jsx` |
| `frontend/src/components/FloatingPet.jsx` | `frontend/src/modules/ai-chat/components/FloatingPet.jsx` |
| `frontend/src/components/LanguageSwitcher.jsx` | `frontend/src/components/ui/LanguageSwitcher.jsx` |
| `frontend/src/components/LoadingScreen.jsx` | `frontend/src/components/ui/LoadingScreen.jsx` |
| `frontend/src/components/LockedExamAudio.jsx` | `frontend/src/modules/exam/components/LockedExamAudio.jsx` |
| `frontend/src/components/PassagePanel.jsx` | `frontend/src/modules/exam/components/PassagePanel.jsx` |
| `frontend/src/components/ProUpgradeCard.jsx` | `frontend/src/modules/billing/components/ProUpgradeCard.jsx` |
| `frontend/src/components/QuestionCard.jsx` | `frontend/src/modules/exam/components/QuestionCard.jsx` |
| `frontend/src/components/QuestionNavigatorDrawer.jsx` | `frontend/src/modules/exam/components/QuestionNavigatorDrawer.jsx` |
| `frontend/src/components/ResizableExamLayout.jsx` | `frontend/src/modules/exam/components/ResizableExamLayout.jsx` |
| `frontend/src/components/ReviewTogglePanel.jsx` | `frontend/src/modules/exam/components/ReviewTogglePanel.jsx` |
| `frontend/src/components/TestModeModal.jsx` | `frontend/src/modules/test-catalog/components/TestModeModal.jsx` |
| `frontend/src/components/admin/ReviewActions.jsx` | `frontend/src/modules/test-management/components/review/ReviewActions.jsx` |
| `frontend/src/components/admin/ReviewTimeline.jsx` | `frontend/src/modules/test-management/components/review/ReviewTimeline.jsx` |
| `frontend/src/components/admin/StaffDialog.jsx` | `frontend/src/modules/staff-management/components/StaffDialog.jsx` |
| `frontend/src/components/admin/StaffPasswordForm.jsx` | `frontend/src/modules/authentication/components/StaffPasswordForm.jsx` |
| `frontend/src/components/admin/SubmissionPreview.jsx` | `frontend/src/modules/test-management/components/review/SubmissionPreview.jsx` |
| `frontend/src/components/admin/SubmissionTable.jsx` | `frontend/src/modules/test-management/components/review/SubmissionTable.jsx` |
| `frontend/src/components/ai-chat/AIChatBox.jsx` | `frontend/src/modules/ai-chat/components/AIChatBox.jsx` |
| `frontend/src/components/ai-chat/AttemptQuestionContextPicker.jsx` | `frontend/src/modules/ai-chat/components/AttemptQuestionContextPicker.jsx` |
| `frontend/src/components/ai-chat/ChatComposer.jsx` | `frontend/src/modules/ai-chat/components/ChatComposer.jsx` |
| `frontend/src/components/ai-chat/ChatMessageList.jsx` | `frontend/src/modules/ai-chat/components/ChatMessageList.jsx` |
| `frontend/src/components/ai-chat/ConversationList.jsx` | `frontend/src/modules/ai-chat/components/ConversationList.jsx` |
| `frontend/src/components/ai-chat/focusTrap.js` | `frontend/src/modules/ai-chat/components/focusTrap.js` |
| `frontend/src/components/ai-chat/focusTrap.test.js` | `frontend/src/modules/ai-chat/components/focusTrap.test.js` |
| `frontend/src/components/floatingPetInteraction.js` | `frontend/src/modules/ai-chat/utils/floatingPetInteraction.js` |
| `frontend/src/components/floatingPetInteraction.test.js` | `frontend/src/modules/ai-chat/utils/floatingPetInteraction.test.js` |
| `frontend/src/components/test-editor/AnswerOptionEditor.jsx` | `frontend/src/modules/test-management/components/test-editor/AnswerOptionEditor.jsx` |
| `frontend/src/components/test-editor/MediaUploader.jsx` | `frontend/src/modules/test-management/components/test-editor/MediaUploader.jsx` |
| `frontend/src/components/test-editor/PartEditor.jsx` | `frontend/src/modules/test-management/components/test-editor/PartEditor.jsx` |
| `frontend/src/components/test-editor/PassageEditor.jsx` | `frontend/src/modules/test-management/components/test-editor/PassageEditor.jsx` |
| `frontend/src/components/test-editor/QuestionEditor.jsx` | `frontend/src/modules/test-management/components/test-editor/QuestionEditor.jsx` |
| `frontend/src/components/test-editor/QuestionGroupEditor.jsx` | `frontend/src/modules/test-management/components/test-editor/QuestionGroupEditor.jsx` |
| `frontend/src/components/test-editor/TestEditorWizard.jsx` | `frontend/src/modules/test-management/components/test-editor/TestEditorWizard.jsx` |
| `frontend/src/components/test-editor/TestMetadataForm.jsx` | `frontend/src/modules/test-management/components/test-editor/TestMetadataForm.jsx` |
| `frontend/src/components/test-editor/TestPreview.jsx` | `frontend/src/modules/test-management/components/test-editor/TestPreview.jsx` |
| `frontend/src/components/test-editor/TestValidationSummary.jsx` | `frontend/src/modules/test-management/components/test-editor/TestValidationSummary.jsx` |
| `frontend/src/components/test-editor/testEditorState.js` | `frontend/src/modules/test-management/components/test-editor/testEditorState.js` |
| `frontend/src/components/test-editor/testEditorState.test.js` | `frontend/src/modules/test-management/components/test-editor/testEditorState.test.js` |
| `frontend/src/components/user/ProAvatarBadge.jsx` | `frontend/src/modules/billing/components/ProAvatarBadge.jsx` |
| `frontend/src/config/examTiming.js` | `frontend/src/modules/exam/config/examTiming.js` |
| `frontend/src/config/examTiming.test.js` | `frontend/src/modules/exam/config/examTiming.test.js` |
| `frontend/src/data/testCatalog.js` | `frontend/src/modules/test-catalog/data/testCatalog.js` |
| `frontend/src/data/testCatalog.test.js` | `frontend/src/modules/test-catalog/data/testCatalog.test.js` |
| `frontend/src/hooks/aiChatSendAttempts.js` | `frontend/src/modules/ai-chat/hooks/aiChatSendAttempts.js` |
| `frontend/src/hooks/aiChatSendAttempts.test.js` | `frontend/src/modules/ai-chat/hooks/aiChatSendAttempts.test.js` |
| `frontend/src/hooks/aiChatState.js` | `frontend/src/modules/ai-chat/hooks/aiChatState.js` |
| `frontend/src/hooks/aiChatState.test.js` | `frontend/src/modules/ai-chat/hooks/aiChatState.test.js` |
| `frontend/src/hooks/useAIChat.js` | `frontend/src/modules/ai-chat/hooks/useAIChat.js` |
| `frontend/src/hooks/useAIExplanationJobs.js` | `frontend/src/modules/ai-analysis/hooks/useAIExplanationJobs.js` |
| `frontend/src/hooks/useUserAttempts.js` | `frontend/src/modules/learning-history/hooks/useUserAttempts.js` |
| `frontend/src/pages/FullTestExam.jsx` | `frontend/src/modules/exam/pages/FullTestExam.jsx` |
| `frontend/src/pages/FullTestIntro.jsx` | `frontend/src/modules/exam/pages/FullTestIntro.jsx` |
| `frontend/src/pages/FullTestResult.jsx` | `frontend/src/modules/exam/pages/FullTestResult.jsx` |
| `frontend/src/pages/FullTestReview.jsx` | `frontend/src/modules/exam/pages/FullTestReview.jsx` |
| `frontend/src/pages/Login.jsx` | `frontend/src/modules/authentication/pages/Login.jsx` |
| `frontend/src/pages/PracticePart.jsx` | `frontend/src/modules/legacy-practice/pages/PracticePart.jsx` |
| `frontend/src/pages/admin/AdminDashboard.jsx` | `frontend/src/modules/dashboard/pages/admin/AdminDashboard.jsx` |
| `frontend/src/pages/admin/AdminOrdersPage.jsx` | `frontend/src/modules/billing/pages/admin/AdminOrdersPage.jsx` |
| `frontend/src/pages/admin/AdminRevenuePage.jsx` | `frontend/src/modules/billing/pages/admin/AdminRevenuePage.jsx` |
| `frontend/src/pages/admin/ConsoleProfilePage.jsx` | `frontend/src/modules/profile/pages/ConsoleProfilePage.jsx` |
| `frontend/src/pages/admin/ReviewHistoryPage.jsx` | `frontend/src/modules/test-management/pages/admin/ReviewHistoryPage.jsx` |
| `frontend/src/pages/admin/ReviewQueuePage.jsx` | `frontend/src/modules/test-management/pages/admin/ReviewQueuePage.jsx` |
| `frontend/src/pages/admin/StaffManagementPage.jsx` | `frontend/src/modules/staff-management/pages/StaffManagementPage.jsx` |
| `frontend/src/pages/admin/TestReviewPage.jsx` | `frontend/src/modules/test-management/pages/admin/TestReviewPage.jsx` |
| `frontend/src/pages/admin/adminPayments.js` | `frontend/src/modules/billing/utils/adminPayments.js` |
| `frontend/src/pages/admin/adminPayments.test.js` | `frontend/src/modules/billing/utils/adminPayments.test.js` |
| `frontend/src/pages/admin/adminRevenue.js` | `frontend/src/modules/billing/utils/adminRevenue.js` |
| `frontend/src/pages/admin/adminRevenue.test.js` | `frontend/src/modules/billing/utils/adminRevenue.test.js` |
| `frontend/src/pages/auth/LoginPage.jsx` | `frontend/src/modules/authentication/pages/LoginPage.jsx` |
| `frontend/src/pages/auth/StaffPasswordPage.jsx` | `frontend/src/modules/authentication/pages/StaffPasswordPage.jsx` |
| `frontend/src/pages/employee/CreateTestPage.jsx` | `frontend/src/modules/test-management/pages/employee/CreateTestPage.jsx` |
| `frontend/src/pages/employee/EditTestPage.jsx` | `frontend/src/modules/test-management/pages/employee/EditTestPage.jsx` |
| `frontend/src/pages/employee/MyTestsPage.jsx` | `frontend/src/modules/test-management/pages/employee/MyTestsPage.jsx` |
| `frontend/src/pages/employee/TestPreviewPage.jsx` | `frontend/src/modules/test-management/pages/employee/TestPreviewPage.jsx` |
| `frontend/src/pages/errors/ForbiddenPage.jsx` | `frontend/src/modules/errors/pages/ForbiddenPage.jsx` |
| `frontend/src/pages/public/LandingPage.jsx` | `frontend/src/modules/public/pages/LandingPage.jsx` |
| `frontend/src/pages/user/AttemptHistoryPage.jsx` | `frontend/src/modules/learning-history/pages/AttemptHistoryPage.jsx` |
| `frontend/src/pages/user/EditProfilePage.jsx` | `frontend/src/modules/profile/pages/EditProfilePage.jsx` |
| `frontend/src/pages/user/PaymentResultPage.jsx` | `frontend/src/modules/billing/pages/user/PaymentResultPage.jsx` |
| `frontend/src/pages/user/PricingPage.jsx` | `frontend/src/modules/billing/pages/user/PricingPage.jsx` |
| `frontend/src/pages/user/ProfilePage.jsx` | `frontend/src/modules/profile/pages/ProfilePage.jsx` |
| `frontend/src/pages/user/TestCatalogPage.jsx` | `frontend/src/modules/test-catalog/pages/TestCatalogPage.jsx` |
| `frontend/src/pages/user/UserDashboard.jsx` | `frontend/src/modules/dashboard/pages/user/UserDashboard.jsx` |
| `frontend/src/utils/aiAnalysis.js` | `frontend/src/modules/ai-analysis/utils/aiAnalysis.js` |
| `frontend/src/utils/aiAnalysis.test.js` | `frontend/src/modules/ai-analysis/utils/aiAnalysis.test.js` |
| `frontend/src/utils/attemptHistory.js` | `frontend/src/modules/learning-history/utils/attemptHistory.js` |
| `frontend/src/utils/attemptHistory.test.js` | `frontend/src/modules/learning-history/utils/attemptHistory.test.js` |
| `frontend/src/utils/examTestCache.js` | `frontend/src/modules/exam/utils/examTestCache.js` |
| `frontend/src/utils/mockToeicTest.js` | `frontend/src/modules/test-management/utils/mockToeicTest.js` |
| `frontend/src/utils/reviewContent.js` | `frontend/src/modules/exam/utils/reviewContent.js` |
| `frontend/src/utils/reviewContent.test.js` | `frontend/src/modules/exam/utils/reviewContent.test.js` |
| `frontend/src/utils/testData.js` | `frontend/src/modules/exam/utils/testData.js` |
| `frontend/src/utils/testData.test.js` | `frontend/src/modules/exam/utils/testData.test.js` |
