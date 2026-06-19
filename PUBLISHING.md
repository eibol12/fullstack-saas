# Publishing this project publicly

This branch (`public/stub-domain-ip`) replaces the proprietary `backend/domain/`
engineering logic with generic, working stubs (see
[`backend/domain/STUB_NOTICE.md`](backend/domain/STUB_NOTICE.md)). The backend
and frontend remain fully functional.

## ⚠️ The current branch is NOT yet safe to publish

Stubbing the files in the latest commit **does not** remove the original
intellectual property from the repository. The real implementations still exist
in **git history** and can be recovered by anyone who clones the repo:

```bash
# Anyone could do this and recover the original IP:
git log --oneline -- backend/domain/standards/dnv.py
git show <old-commit>:backend/domain/standards/dnv.py
```

Before making the repository public you **must** publish from a history with no
trace of the proprietary files. Pick **one** of the options below.

### Option A — Fresh repository from a single squashed commit (simplest, recommended)

Publishes only the current tree, with no history at all.

```bash
# From the stubbed branch, with a clean working tree:
git checkout public/stub-domain-ip

# Create an orphan branch: no parents, no history
git checkout --orphan public-release
git add -A
git commit -m "Public release: backend + frontend with stubbed domain layer"

# Push to the NEW public remote (not the private origin)
git remote add public git@github.com:<org>/<public-repo>.git
git push public public-release:main
```

The new public repo's `main` has exactly one commit and contains only the
stubbed code. The private repo (with full history + real IP) stays untouched.

### Option B — Strip the proprietary files from all history

Keeps commit history but removes the named files from every commit. Use
[`git filter-repo`](https://github.com/newren/git-filter-repo) (preferred over
the deprecated `filter-branch`):

```bash
pip install git-filter-repo

# Work on a CLONE you intend to publish — this rewrites history irreversibly.
git clone --no-local . ../public-clone
cd ../public-clone

git filter-repo \
  --path backend/domain/standards/dnv.py \
  --path backend/domain/structure/calculator.py \
  --path backend/domain/structure/structure.py \
  --path backend/domain/geometry/element.py \
  --path backend/domain/rigging/design.py \
  --path backend/domain/rigging/selector.py \
  --path backend/domain/rigging/utilization.py \
  --path backend/domain/rigging/geometric_compatibility.py \
  --path backend/domain/rigging/geometry.py \
  --path backend/domain/rigging/arrangement.py \
  --invert-paths
```

This deletes those paths from **all** commits. You then re-add the **stubbed**
versions in a final commit and push to the public remote. Note: this leaves the
files absent from older commits (the app won't build at those points in
history) — Option A avoids that entirely, which is why it's recommended.

## Checklist before going public

- [ ] Confirm `backend/domain/` contains only stubs (see `STUB_NOTICE.md` table).
- [ ] Scrub history via Option A or B above — verify with
      `git log --all --oneline -- backend/domain/standards/dnv.py` returns nothing.
- [ ] Audit for other secrets: `.env` files, API keys, Stripe keys, DB dumps,
      `backend/test_media/`, customer data in fixtures/migrations.
- [ ] Review `README.md` / `AGENTS.md` / `RAG_ARCHITECTURE_PLAN.md` for any
      proprietary algorithm descriptions you don't want public.
- [ ] Add a LICENSE appropriate for a public release.
- [ ] Push to a **new** public remote, never `git push --force` over the private origin.
