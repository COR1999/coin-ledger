import { AppHeader } from "@/components/app/app-header";
import { ChatPanel } from "@/components/chat/chat-panel";
import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentActor, listActors } from "@/lib/session";

export default async function ChatPage() {
  const repos = getRepositories();
  const [business, actor] = await Promise.all([
    repos.business.get(),
    getCurrentActor(),
  ]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <AppHeader
        businessName={business.name}
        actors={listActors()}
        currentActor={actor}
        active="chat"
      />
      <main className="mx-auto w-full max-w-3xl flex-1">
        <ChatPanel actorName={actor.name} />
      </main>
    </div>
  );
}
