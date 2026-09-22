import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CollaboratorControls from "@/components/workspaces/CollaboratorControls";
import { ToastProvider } from "@/components/feedback/ToastProvider";

const mocks = vi.hoisted(() => ({ manage: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/dashboard/workspace/actions", () => ({ manageCollaborator: mocks.manage }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

describe("collaborator controls", () => {
  it("offers member/viewer access and protects privileged memberships", () => {
    render(<ToastProvider><CollaboratorControls workspaceId="workspace" members={[{ user_id: "owner", display_name: "Owner", email: "owner@example.com", role: "owner" }]} /></ToastProvider>);
    expect(screen.getByRole("button", { name: "Add collaborator" })).toBeInTheDocument();
    expect(screen.getByText("Protected role")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Admin" })).not.toBeInTheDocument();
  });
  it("clears a successful addition and refreshes the roster", async () => {
    mocks.manage.mockResolvedValue({ ok: true, message: "Collaborator added.", operation: "add" });
    render(<ToastProvider><CollaboratorControls workspaceId="workspace" members={[]} /></ToastProvider>);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "friend@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add collaborator" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Collaborator added."));
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(mocks.refresh).toHaveBeenCalled();
    expect(document.querySelector(".authMessage")).not.toBeInTheDocument();
  });
  it("reconciles a role control when refreshed server data changes", () => {
    const member = { user_id: "person", display_name: "Person", email: "person@example.com", role: "viewer" as const };
    const view = render(<ToastProvider><CollaboratorControls workspaceId="workspace" members={[member]} /></ToastProvider>);
    expect(screen.getByRole("combobox", { name: "Role for person@example.com" })).toHaveValue("viewer");

    view.rerender(<ToastProvider><CollaboratorControls workspaceId="workspace" members={[{ ...member, role: "member" }]} /></ToastProvider>);
    expect(screen.getByRole("combobox", { name: "Role for person@example.com" })).toHaveValue("member");
  });
  it("keeps the authoritative role selected after a successful save", async () => {
    mocks.manage.mockResolvedValue({
      ok: true,
      message: "Role updated.",
      operation: "role",
      collaboratorId: "person",
      role: "viewer",
    });
    render(<ToastProvider><CollaboratorControls workspaceId="workspace" members={[{
      user_id: "person", display_name: "Person", email: "person@example.com", role: "member",
    }]} /></ToastProvider>);

    const role = screen.getByRole("combobox", { name: "Role for person@example.com" });
    fireEvent.change(role, { target: { value: "viewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save role" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Role updated."));
    expect(role).toHaveValue("viewer");
    expect(document.querySelector(".authMessage")).not.toBeInTheDocument();
  });
});
