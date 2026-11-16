import usePageTitle from "../../../../components/ui/usePageTitle";
import TestEditorWizard from "../../components/test-editor/TestEditorWizard";

function CreateTestPage() {
  usePageTitle("Tạo đề mới");
  return <TestEditorWizard mode="create" />;
}

export default CreateTestPage;
