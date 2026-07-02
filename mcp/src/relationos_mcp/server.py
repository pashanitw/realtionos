"""RelationOS MCP server — registers the service layer as MCP tools.

Run: `uv run relationos-mcp` (stdio). The service functions are plain async
functions (importable without MCP) so the future FastAPI app reuses them.
"""

from mcp.server.fastmcp import FastMCP

from .service import catalog, contacts, pipeline, work, workspace

mcp = FastMCP(
    "relationos",
    instructions=(
        "RelationOS: an AI-native, config-driven CRM. This server is scoped to "
        "ONE tenant. Call get_workspace first — it tells you the tenant's "
        "terminology (what contacts/deals/appointments are called here), the "
        "pipeline stages and their rules, and the custom field keys every "
        "other tool expects. Writes are real: they persist, emit domain "
        "events, and appear in the activity feed."
    ),
)

# Orient
mcp.tool()(workspace.get_workspace)
# Contacts
mcp.tool()(contacts.get_worklist)
mcp.tool()(contacts.search_contacts)
mcp.tool()(contacts.get_contact)
mcp.tool()(contacts.create_contact)
mcp.tool()(contacts.set_contact_field)
# Pipeline
mcp.tool()(pipeline.get_pipeline)
mcp.tool()(pipeline.create_deal)
mcp.tool()(pipeline.move_deal_stage)
# Catalog
mcp.tool()(catalog.list_inventory)
mcp.tool()(catalog.match_catalog_for_contact)
# Work
mcp.tool()(work.create_task)
mcp.tool()(work.get_activity_feed)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
