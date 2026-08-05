"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/firebase-provider";
import {
  getBusiness,
  subscribeBranches,
  subscribeBusiness,
  subscribeBusinessCatalog,
  subscribeBusinessClaimsForBusiness,
  subscribeBusinessFinanceSettings,
  subscribeBusinessInvitations,
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
import { defaultOperationalSettings } from "@/data/business-config";

const BusinessContext = createContext(null);

function uniqueBusinessIds(memberships) {
  const ids = new Set();
  memberships.forEach((membership) => {
    if (membership.businessId) ids.add(membership.businessId);
    (membership.businessIds || []).forEach((id) => ids.add(id));
  });
  return [...ids];
}

export function BusinessDataProvider({ children }) {
  const { user, memberships } = useAuth();
  const businessIds = useMemo(() => uniqueBusinessIds(memberships), [memberships]);
  const businessIdsKey = useMemo(() => businessIds.join("|"), [businessIds]);
  const [businessChoices, setBusinessChoices] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [business, setBusiness] = useState(null);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
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

  useEffect(() => {
    if (!businessIds.length) {
      setBusinessChoices([]);
      setSelectedBusinessId("");
      return undefined;
    }
    let active = true;
    Promise.all(businessIds.map(async (id) => {
      try { return await getBusiness(id); } catch { return null; }
    })).then((items) => {
      if (!active) return;
      const choices = items.filter(Boolean);
      setBusinessChoices(choices);
      const stored = typeof window !== "undefined" ? window.localStorage.getItem("spotly-business-id") : "";
      const next = businessIds.includes(stored) ? stored : businessIds[0];
      setSelectedBusinessId((current) => businessIds.includes(current) ? current : next);
    });
    return () => { active = false; };
  }, [businessIds, businessIdsKey]);

  useEffect(() => {
    if (!selectedBusinessId) {
      setBusiness(null);
      setBranches([]);
      setProducts([]);
      setOrders([]);
      setClaims([]);
      setInvitations([]);
      setMembers([]);
      setFinance(null);
      setOperations(defaultOperationalSettings);
      setPromotions([]);
      setPayouts([]);
      setSupport([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError("");
    if (typeof window !== "undefined") window.localStorage.setItem("spotly-business-id", selectedBusinessId);
    const onError = (reason) => {
      setError(reason?.message || "Some business information could not be loaded.");
      setLoading(false);
    };
    const cleanups = [
      subscribeBusiness(selectedBusinessId, (value) => {
        setBusiness(value);
        setBusinessChoices((current) => {
          if (!value) return current;
          const exists = current.some((item) => item.id === value.id);
          return exists ? current.map((item) => item.id === value.id ? value : item) : [...current, value];
        });
        setLoading(false);
      }, onError),
      subscribeBranches(selectedBusinessId, setBranches, onError),
      subscribeBusinessCatalog(selectedBusinessId, setProducts, onError),
      subscribeOrdersForBusiness(selectedBusinessId, setOrders, onError),
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
  }, [selectedBusinessId]);

  useEffect(() => subscribeCatalogTemplates(setTemplates, () => {}), []);

  const membership = useMemo(() => memberships.find((item) => item.businessId === selectedBusinessId || item.businessIds?.includes(selectedBusinessId)) || null, [memberships, selectedBusinessId]);
  const value = useMemo(() => ({
    user,
    memberships,
    membership,
    businessIds,
    businessChoices,
    selectedBusinessId,
    setSelectedBusinessId,
    business,
    branches,
    products,
    orders,
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
    error
  }), [user, memberships, membership, businessIds, businessChoices, selectedBusinessId, business, branches, products, orders, claims, invitations, members, finance, operations, promotions, payouts, support, templates, loading, error]);

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusinessWorkspace() {
  const value = useContext(BusinessContext);
  if (!value) throw new Error("useBusinessWorkspace must be used inside BusinessDataProvider.");
  return value;
}
