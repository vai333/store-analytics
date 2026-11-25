export type RoleId = "ceo" | "sales_head" | "product_head" | "store_head";
export type Table = "stores" | "products" | "sales";

export interface Role {
  id: RoleId;
  label: string;
  blurb: string;
  tables: Table[];
  dbRole: string;
}

export const ROLES: Record<RoleId, Role> = {
  ceo: { id: "ceo", label: "CEO", blurb: "Everything: stores, products and sales.", tables: ["stores", "products", "sales"], dbRole: "ceo_ro" },
  sales_head: { id: "sales_head", label: "Sales head", blurb: "Sales data only.", tables: ["sales"], dbRole: "sales_ro" },
  product_head: { id: "product_head", label: "Product head", blurb: "Product data only.", tables: ["products"], dbRole: "product_ro" },
  store_head: { id: "store_head", label: "Store head", blurb: "Store data only.", tables: ["stores"], dbRole: "store_ro" },
};

export const ROLE_LIST = Object.values(ROLES);
export const isRoleId = (v: unknown): v is RoleId => typeof v === "string" && v in ROLES;
