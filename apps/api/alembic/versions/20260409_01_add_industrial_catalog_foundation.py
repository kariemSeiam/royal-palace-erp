from alembic import op
import sqlalchemy as sa

revision = "20260409_01"
down_revision = "9f1a2b3c4d5e"
branch_labels = None
depends_on = None


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    try:
        return any(col["name"] == column_name for col in inspector.get_columns(table_name))
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "products" in tables:
        new_columns = {
            "product_family": sa.String(length=100),
            "product_type": sa.String(length=100),
            "production_mode": sa.String(length=100),
            "thickness_cm": sa.Numeric(10, 2),
            "width_cm": sa.Numeric(10, 2),
            "length_cm": sa.Numeric(10, 2),
            "foam_density": sa.Numeric(10, 2),
            "foam_density_unit": sa.String(length=50),
            "firmness_level": sa.String(length=100),
            "has_springs": sa.Boolean(),
            "spring_type": sa.String(length=100),
            "has_pillow_top": sa.Boolean(),
            "has_wood_frame": sa.Boolean(),
            "fabric_spec": sa.Text(),
            "requires_upholstery": sa.Boolean(),
            "requires_quilting": sa.Boolean(),
            "notes_internal": sa.Text(),
        }

        for name, coltype in new_columns.items():
            if not _has_column(inspector, "products", name):
                op.add_column("products", sa.Column(name, coltype, nullable=True))

    if "product_bom_items" not in tables:
        op.create_table(
            "product_bom_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
            sa.Column("line_no", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("material_name", sa.String(length=255), nullable=False),
            sa.Column("material_code", sa.String(length=100), nullable=True),
            sa.Column("material_type", sa.String(length=100), nullable=True),
            sa.Column("quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
            sa.Column("unit", sa.String(length=50), nullable=True),
            sa.Column("waste_percent", sa.Numeric(8, 2), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        )
        op.create_index("ix_product_bom_items_product_id", "product_bom_items", ["product_id"])
        op.create_index("ix_product_bom_items_material_code", "product_bom_items", ["material_code"])

    if "product_routing_steps" not in tables:
        op.create_table(
            "product_routing_steps",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
            sa.Column("step_no", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("step_code", sa.String(length=100), nullable=True),
            sa.Column("step_name", sa.String(length=255), nullable=False),
            sa.Column("work_center", sa.String(length=255), nullable=True),
            sa.Column("standard_minutes", sa.Numeric(10, 2), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("is_outsourced", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        )
        op.create_index("ix_product_routing_steps_product_id", "product_routing_steps", ["product_id"])
        op.create_index("ix_product_routing_steps_step_code", "product_routing_steps", ["step_code"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "product_routing_steps" in tables:
        op.drop_index("ix_product_routing_steps_step_code", table_name="product_routing_steps")
        op.drop_index("ix_product_routing_steps_product_id", table_name="product_routing_steps")
        op.drop_table("product_routing_steps")

    if "product_bom_items" in tables:
        op.drop_index("ix_product_bom_items_material_code", table_name="product_bom_items")
        op.drop_index("ix_product_bom_items_product_id", table_name="product_bom_items")
        op.drop_table("product_bom_items")

    if "products" in tables:
        inspector = sa.inspect(bind)
        for name in [
            "product_family",
            "product_type",
            "production_mode",
            "thickness_cm",
            "width_cm",
            "length_cm",
            "foam_density",
            "foam_density_unit",
            "firmness_level",
            "has_springs",
            "spring_type",
            "has_pillow_top",
            "has_wood_frame",
            "fabric_spec",
            "requires_upholstery",
            "requires_quilting",
            "notes_internal",
        ]:
            if _has_column(inspector, "products", name):
                op.drop_column("products", name)
