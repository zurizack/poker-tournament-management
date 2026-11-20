import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { TemplateManager } from "../../components/TemplateManager";

export function TemplatesPage() {
  const { token, username } = useAuth();
  const navigate = useNavigate();

  function handleOpenTemplate(templateId) {
    navigate(`/manager/setup?templateId=${encodeURIComponent(templateId)}`);
  }

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold">Templates</h1>
        <TemplateManager token={token} username={username} onOpen={handleOpenTemplate} />
      </div>
    </div>
  );
}
