"use client";

import { CreateArenaForm } from "@/components/arena/create-arena-form";

export default function NewArenaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Arena</h1>
        <p className="text-muted-foreground">
          Configure an arena battle between your bots
        </p>
      </div>
      <CreateArenaForm />
    </div>
  );
}
