import { AppHeader } from "@/components/app/app-header";
import { ChatPanel } from "@/components/chat/chat-panel";
import {
  DEMO_WORKSPACE_ID,
  getRepositories,
} from "@/lib/repositories/singleton";
import { getCurrentActor, listActors } from "@/lib/session";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export default async function ChatPage() {
  const workspaceId = await getCurrentWorkspaceId();
  const repos = getRepositories(workspaceId);
  const [business, actors, actor, policies] = await Promise.all([
    repos.business.get(),
    listActors(),
    getCurrentActor(),
    repos.policies.get(),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <AppHeader
        businessName={business.name}
        actors={actors}
        currentActor={actor}
        active="chat"
        isDemo={workspaceId === DEMO_WORKSPACE_ID}
      />
      <main className="mx-auto w-full max-w-3xl flex-1">
        <ChatPanel actorName={actor.name} paused={policies.paymentsPaused} />
      </main>
    </div>
  );
}
