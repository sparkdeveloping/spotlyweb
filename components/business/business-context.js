"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth, usePlatform } from "@/components/firebase-provider";
import {
  subscribeBranches,
  subscribeBusiness,
  subscribeBusinessCatalog,
  subscribeBusinessClaimsForBusiness,
  subscribeBusinessFinanceSettings,
  subscribeBusinessInvitations,
  getBranchesForBusiness,
  subscribeOrdersForBusiness,
  subscribeSupportConversations
} from "@/lib/firebase-services";
import {
  subscribeBusinessMembers,
  subscribeBusinessOperationalSettings,
  subscribeBusinessPayouts,
  subscribeCatalogTemplates,
  subscribePromotions
} from "@/lib/business-services";
import { authenticatedFetch } from "@/lib/api-client";
import { defaultOperationalSettings } from "@/data/business-config";
import { businessArchetype, inferBusinessType } from "@/data/business-archetypes";
import { readState, writeState } from "@/lib/browser-state";
import { businessHref, businessSectionFromPath, isBusinessAccountSection } from "@/lib/business-routing";

const BusinessContext = createContext(null);

function canUseEveryBranch(membership) {
  const role = membership?.role || "";
  const permissions = membership?.permissions || [];
  return ["organization_owner", "business_owner", "business_manager"].includes(role)
    || permissions.includes("*")
    || permissions.includes("organization.*")
    || permissions.includes("businesses.*")
    || permissions.includes("branches.*");
}

function routeWithBusiness(pathname, searchParams, businessId) {
  const params = Object.fromEntries(new URLSearchParams(searchParams.toString()).entries());
  delete params.business;
  return businessHref(pathname, { businessId, ...params });
}

export function BusinessDataProvider({ children }) {
  const { user, memberships } = useAuth();
  const { settings: platformSettings } = usePlatform();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedBusinessId = searchParams.get("business") || "";
  const [businessChoices, setBusinessChoices] = useState([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState("");
  const [selectedBusinessId, setSelectedBusinessIdState] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [business, setBusiness] = useState(null);
  const [loadedBusinessId, setLoadedBusinessId] = useState("");
  const [allBranches, setAllBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [claims, setClaims] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [members, setMembers] = useState([]);
  const [finance, setFinance] = useState(null);
  const [operations, setOperations] = useState(defaultOperationalSettings);
  const [promotions, setPromotions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [support, setSupport] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authoritativeLifecycle, setAuthoritativeLifecycle] = useState(null);
  const [lifecycleBusinessId, setLifecycleBusinessId] = useState("");
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleError, setLifecycleError] = useState("");

  const refreshPortfolio = useCallback(async () => {
    if (!user?.uid) {
      setBusinessChoices([]);
      setPortfolioLoading(false);
      return;
    }
    setPortfolioLoading(true);
    setPortfolioError("");
    try {
      const payload = await authenticatedFetch("/api/business/portfolio", { cache: "no-store" });
      setBusinessChoices(payload.businesses || []);
    } catch (reason) {
      setPortfolioError(reason?.message || "Your business portfolio could not be loaded.");
      setBusinessChoices([]);
    } finally {
      setPortfolioLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { refreshPortfolio(); }, [refreshPortfolio, memberships]);

  const refreshLifecycle = useCallback(async (businessId = selectedBusinessId, { silent = false } = {}) => {
    if (!user?.uid || !businessId) return null;
    if (!silent) setLifecycleLoading(true);
    setLifecycleError("");
    try {
      const payload = await authenticatedFetch(`/api/business/lifecycle?businessId=${encodeURIComponent(businessId)}`, { cache: "no-store" });
      const nextLifecycle = payload.lifecycle || null;
      setAuthoritativeLifecycle(nextLifecycle);
      setLifecycleBusinessId(businessId);
      if (nextLifecycle) {
        // Keep the Portfolio card synchronized with the exact selected-business snapshot instead
        // of waiting for a separately timed portfolio refresh to recalculate the same lifecycle.
        setBusinessChoices((current) => current.map((choice) => choice.id === businessId ? {
          ...choice,
          setupComplete: Boolean(nextLifecycle.setup?.complete),
          lifecycleStage: nextLifecycle.stage,
          lifecycleLabel: nextLifecycle.statusLabel,
          merchantProgress: nextLifecycle.merchantProgress,
          defaultHref: nextLifecycle.defaultHref,
          lifecycleActionLabel: nextLifecycle.nextAction?.actionLabel || (nextLifecycle.stage === "live" ? "Open business" : nextLifecycle.stage === "review" ? "View Spotly review" : "Open launch checklist"),
          launchReviewStatus: nextLifecycle.launchReview?.status || "",
          externalReviewCount: nextLifecycle.externalReviewCount || 0,
          merchantActionCount: nextLifecycle.merchantActionCount || 0,
          attention: nextLifecycle.nextAction && (nextLifecycle.stage !== "live" || !nextLifecycle.canOperate) ? [{ type: nextLifecycle.nextAction.id, label: nextLifecycle.nextAction.label, href: nextLifecycle.nextAction.href }] : []
        } : choice));
      }
      return nextLifecycle;
    } catch (reason) {
      setLifecycleError(reason?.message || "The authoritative launch status could not be loaded.");
      setLifecycleBusinessId(businessId);
      return null;
    } finally {
      if (!silent) setLifecycleLoading(false);
    }
  }, [selectedBusinessId, user?.uid]);

  const refreshBranches = useCallback(async (businessId = selectedBusinessId, { silent = false } = {}) => {
    if (!businessId || !user?.uid) return [];
    if (!silent) setBranchesLoading(true);
    setBranchesError("");
    try {
      const records = await getBranchesForBusiness(businessId);
      if (businessId === selectedBusinessId) setAllBranches(records);
      return records;
    } catch (reason) {
      if (businessId === selectedBusinessId) setBranchesError(reason?.message || "Locations could not be loaded.");
      throw reason;
    } finally {
      if (!silent && businessId === selectedBusinessId) setBranchesLoading(false);
    }
  }, [selectedBusinessId, user?.uid]);

  const businessIds = useMemo(() => businessChoices.map((item) => item.id), [businessChoices]);
  const selectedChoice = useMemo(() => businessChoices.find((item) => item.id === selectedBusinessId) || null, [businessChoices, selectedBusinessId]);
  const storedMembership = memberships.find((item) => item.businessId === selectedBusinessId || item.businessIds?.includes(selectedBusinessId) || (selectedChoice?.organizationId && item.organizationId === selectedChoice.organizationId && item.role === "organization_owner")) || null;
  // Portfolio is produced by the trusted server and can legitimately expose direct-owner access
  // for older businesses that predate membership documents. Keep client permissions aligned with
  // that trusted access instead of making an owner look read-only only on the Locations screen.
  const membership = storedMembership || (selectedChoice ? {
    id: `portfolio:${selectedBusinessId}`,
    userId: user?.uid || "",
    businessId: selectedBusinessId,
    organizationId: selectedChoice.organizationId || null,
    role: selectedChoice.role || "member",
    status: "active",
    branchIds: selectedChoice.branchIds || [],
    permissions: selectedChoice.permissions || []
  } : null);

  useEffect(() => {
    if (portfolioLoading) return;
    const availableIds = businessChoices.map((item) => item.id);
    if (!availableIds.length) {
      setSelectedBusinessIdState("");
      return;
    }
    if (requestedBusinessId && !availableIds.includes(requestedBusinessId)) {
      setSelectedBusinessIdState("");
      setPortfolioError("This account does not currently have access to the business in this link.");
      return;
    }
    const stored = readState("spotly-business-id", user, "", "local");
    const currentAllowed = availableIds.includes(selectedBusinessId) ? selectedBusinessId : "";
    const next = requestedBusinessId || currentAllowed || (availableIds.includes(stored) ? stored : availableIds[0]);
    if (next !== selectedBusinessId) setSelectedBusinessIdState(next);
    if (next) writeState("spotly-business-id", user, next, "local");

    const section = businessSectionFromPath(pathname);
    if (!requestedBusinessId && !isBusinessAccountSection(section) && pathname.startsWith("/business/") && next) {
      router.replace(routeWithBusiness(pathname, searchParams, next), { scroll: false });
    }
  }, [businessChoices, pathname, portfolioLoading, requestedBusinessId, router, searchParams, selectedBusinessId, user]);

  const setSelectedBusinessId = useCallback((nextId) => {
    const choice = businessChoices.find((item) => item.id === nextId);
    if (!choice) return;
    setSelectedBusinessIdState(nextId);
    writeState("spotly-business-id", user, nextId, "local");
    router.push(choice.defaultHref || businessHref("/business/launch", { businessId: nextId }));
  }, [businessChoices, router, user]);

  const branches = useMemo(() => {
    if (selectedChoice?.businessWide || canUseEveryBranch(membership) || !(membership?.branchIds || []).length) return allBranches;
    const allowed = new Set(membership.branchIds);
    return allBranches.filter((branch) => allowed.has(branch.id));
  }, [allBranches, membership, selectedChoice?.businessWide]);

  useEffect(() => {
    if (!selectedBusinessId) {
      setBusiness(null);
      setLoadedBusinessId("");
      setAllBranches([]);
      setBranchesLoading(false);
      setBranchesError("");
      setSelectedBranchId("");
      setProducts([]);
      setProductsLoading(false);
      setProductsError("");
      setOrders([]);
      setOrdersLoading(false);
      setOrdersError("");
      setClaims([]);
      setInvitations([]);
      setMembers([]);
      setFinance(null);
      setOperations(defaultOperationalSettings);
      setPromotions([]);
      setPayouts([]);
      setSupport([]);
      setAuthoritativeLifecycle(null);
      setLifecycleBusinessId("");
      setLifecycleLoading(false);
      setLifecycleError("");
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError("");
    setLoadedBusinessId("");
    setAllBranches([]);
    setBranchesLoading(true);
    setBranchesError("");
    setProducts([]);
    setProductsLoading(true);
    setProductsError("");
    setOrders([]);
    setOrdersLoading(true);
    setOrdersError("");
    writeState("spotly-business-id", user, selectedBusinessId, "local");
    const onError = (reason) => {
      setError(reason?.message || "Some business information could not be loaded.");
      setLoading(false);
    };
    const cleanups = [
      subscribeBusiness(selectedBusinessId, (value) => {
        setBusiness(value);
        setLoadedBusinessId(value?.id || "");
        setLoading(false);
      }, onError),
      subscribeBranches(selectedBusinessId, (records) => {
        setAllBranches(records);
        setBranchesLoading(false);
        setBranchesError("");
      }, (reason) => {
        setBranchesLoading(false);
        setBranchesError(reason?.message || "Locations could not be loaded.");
      }),
      subscribeBusinessCatalog(selectedBusinessId, (records) => {
        setProducts(records);
        setProductsLoading(false);
        setProductsError("");
      }, (reason) => {
        setProductsLoading(false);
        setProductsError(reason?.message || "Products could not be loaded.");
      }),
      subscribeOrdersForBusiness(selectedBusinessId, (records) => {
        setOrders(records);
        setOrdersLoading(false);
        setOrdersError("");
      }, (reason) => {
        setOrdersLoading(false);
        setOrdersError(reason?.message || "Orders could not be loaded.");
      }),
      subscribeBusinessClaimsForBusiness(selectedBusinessId, setClaims, onError),
      subscribeBusinessInvitations(selectedBusinessId, setInvitations, onError),
      subscribeBusinessMembers(selectedBusinessId, setMembers, onError),
      subscribeBusinessFinanceSettings(selectedBusinessId, setFinance, onError),
      subscribeBusinessOperationalSettings(selectedBusinessId, (value) => setOperations({ ...defaultOperationalSettings, ...(value || {}) }), onError),
      subscribePromotions(selectedBusinessId, setPromotions, onError),
      subscribeBusinessPayouts(selectedBusinessId, setPayouts, onError),
      subscribeSupportConversations(setSupport, { businessId: selectedBusinessId, onError })
    ];
    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, [selectedBusinessId, user]);

  useEffect(() => {
    if (!selectedBusinessId) return;
    setAuthoritativeLifecycle(null);
    setLifecycleBusinessId("");
    refreshLifecycle(selectedBusinessId);
  }, [refreshLifecycle, selectedBusinessId]);

  useEffect(() => {
    if (!selectedBusinessId || loadedBusinessId !== selectedBusinessId) return undefined;
    const timer = setTimeout(() => { refreshLifecycle(selectedBusinessId, { silent: true }); }, 180);
    return () => clearTimeout(timer);
  }, [allBranches, business, claims, invitations, loadedBusinessId, members, operations, products, refreshLifecycle, selectedBusinessId]);

  useEffect(() => {
    if (!branches.length) { setSelectedBranchId(""); return; }
    const storageKey = `spotly-branch-id:${selectedBusinessId}`;
    const stored = readState(storageKey, user, "", "local");
    const next = branches.some((branch) => branch.id === stored) ? stored : branches[0].id;
    setSelectedBranchId((current) => branches.some((branch) => branch.id === current) ? current : next);
  }, [branches, selectedBusinessId, user]);

  useEffect(() => {
    if (selectedBusinessId && selectedBranchId) writeState(`spotly-branch-id:${selectedBusinessId}`, user, selectedBranchId, "local");
  }, [selectedBusinessId, selectedBranchId, user]);

  useEffect(() => subscribeCatalogTemplates(setTemplates, () => {}), []);

  const authoritativeBranch = authoritativeLifecycle?.canonicalLocation || null;
  const selectedBranch = useMemo(() => branches.find((branch) => branch.id === selectedBranchId) || branches.find((branch) => branch.id === authoritativeBranch?.id) || branches[0] || authoritativeBranch || null, [authoritativeBranch, branches, selectedBranchId]);
  const businessType = inferBusinessType(business || {});
  const archetype = businessArchetype(business || {});
  const businessSwitching = Boolean(selectedBusinessId && loadedBusinessId !== selectedBusinessId);
  const lifecycleSwitching = Boolean(selectedBusinessId && lifecycleBusinessId !== selectedBusinessId && !lifecycleError);
  const contextSwitching = businessSwitching || lifecycleSwitching;
  // Selected-business lifecycle state is server authoritative. Portfolio cards and the final
  // submit endpoint use the same lifecycle engine against Admin SDK data; the browser never
  // substitutes a second readiness calculation when that authoritative snapshot is unavailable.
  const lifecycle = lifecycleBusinessId === selectedBusinessId ? authoritativeLifecycle : null;
  const setupComplete = Boolean(lifecycle?.setup?.complete);

  const value = useMemo(() => ({
    user,
    memberships,
    membership,
    businessIds,
    businessChoices,
    portfolioLoading,
    portfolioError,
    refreshPortfolio,
    refreshLifecycle,
    refreshBranches,
    selectedBusinessId,
    setSelectedBusinessId,
    business,
    loadedBusinessId,
    contextSwitching,
    allBranches,
    branches,
    branchesLoading,
    branchesError,
    selectedBranchId,
    setSelectedBranchId,
    selectedBranch,
    products,
    productsLoading,
    productsError,
    orders,
    ordersLoading,
    ordersError,
    claims,
    invitations,
    members,
    finance,
    operations,
    promotions,
    payouts,
    support,
    templates,
    loading,
    lifecycleLoading,
    lifecycleError,
    lifecycleBusinessId,
    lifecycleAuthoritative: lifecycleBusinessId === selectedBusinessId && Boolean(authoritativeLifecycle),
    error: error || lifecycleError || portfolioError,
    businessType,
    archetype,
    setupComplete,
    lifecycle
  }), [user, memberships, membership, businessIds, businessChoices, portfolioLoading, portfolioError, refreshPortfolio, refreshLifecycle, refreshBranches, selectedBusinessId, setSelectedBusinessId, business, loadedBusinessId, contextSwitching, allBranches, branches, branchesLoading, branchesError, selectedBranchId, selectedBranch, products, productsLoading, productsError, orders, ordersLoading, ordersError, claims, invitations, members, finance, operations, promotions, payouts, support, templates, loading, lifecycleLoading, lifecycleError, lifecycleBusinessId, authoritativeLifecycle, error, businessType, archetype, setupComplete, lifecycle]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusinessWorkspace() {
  const value = useContext(BusinessContext);
  if (!value) throw new Error("useBusinessWorkspace must be used inside BusinessDataProvider.");
  return value;
}
