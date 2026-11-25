# Store Analytics Assistant

Chat with your retail data in plain English. Role-based access (CEO, Sales head, Product head, Store head), SQL checked by code and a second model, read-only execution, a 2 hour cache and a query log.

- `web/` Next.js app for Vercel (set the Root Directory to `web`). Setup steps are in `web/README.md`.
- `docs/PRD.md` and `docs/ARCHITECTURE.md` the product and design docs.
- `make_data.py` builds the synthetic `retail.db`; `glossary.md` is the semantic layer.
