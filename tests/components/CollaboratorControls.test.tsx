import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CollaboratorControls from "@/components/workspaces/CollaboratorControls";

const mocks = vi.hoisted(() => ({ manage: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/dashboard/workspace/actions", () => ({ manageCollaborator: mocks.manage }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

describe("collaborator controls", () => {
  it("offers member/viewer access and protects privileged memberships", () => {
    render(<CollaboratorControls workspaceId="workspace" members={[{ user_id: "owner", display_name: "Owner", email: "owner@example.com", role: "owner" }]} />);
    expect(screen.getByRole("button", { name: "Add collaborator" })).toBeInTheDocument();
    expect(screen.getByText("Protected role")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Admin" })).not.toBeInTheDocument();
  });
  it("clears a successful addition and refreshes the roster", async () => {
    mocks.manage.mockResolvedValue({ ok: true, message: "Collaborator added." });
    render(<CollaboratorControls workspaceId="workspace" members={[]} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "friend@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add collaborator" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Collaborator added."));
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
