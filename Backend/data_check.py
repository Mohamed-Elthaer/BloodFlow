# data_check.py
import pandas as pd
import Backend.config as config

errors = []    # هنجمع فيها أي مشكلة نلاقيها

# 1) عرض البيانات كجدول
cost_df = pd.DataFrame(config.COST, index=config.DESTS).T
print("Cost Table")
print(cost_df)
print()

# 2) هل كل صف فيه 5 تكاليف؟
for s in config.SOURCES:
    if len(config.COST[s]) != len(config.DESTS):
        errors.append(f"الصف {s} عدد تكاليفه غلط")

# 3) أرقام سالبة؟
for s, row in config.COST.items():
    for d, c in zip(config.DESTS, row):
        if c is not None and c < 0:
            errors.append(f"تكلفة سالبة في {s}->{d}")
for name, value in {**config.SUPPLY, **config.DEMAND}.items():
    if value < 0:
        errors.append(f"كمية سالبة في {name}")

# 4) الأسماء متطابقة؟
if set(config.SUPPLY) != set(config.SOURCES):
    errors.append("أسماء العرض مش مطابقة لأسماء المصادر")
if set(config.DEMAND) != set(config.DESTS):
    errors.append("أسماء الطلب مش مطابقة لأسماء المستشفيات")

# 5) المسارات الممنوعة هي نفسها الخلايا الفاضية (None)؟
none_cells = {
    (s, d)
    for s in config.SOURCES
    for d, c in zip(config.DESTS, config.COST[s])
    if c is None
}
if none_cells != set(config.PROHIBITED):
    errors.append("المسارات الممنوعة مش مطابقة للخلايا اللي تكلفتها None")

# 6) حدود السعة على مسارات موجودة ومش ممنوعة؟
for (s, d), cap in config.CAPACITY.items():
    if s not in config.SOURCES or d not in config.DESTS:
        errors.append(f"حد سعة على مسار مش موجود: {s}->{d}")
    if (s, d) in config.PROHIBITED:
        errors.append(f"حد سعة على مسار ممنوع: {s}->{d}")
    if cap < 0:
        errors.append(f"حد سعة سالب: {s}->{d}")

# 7) هل العرض = الطلب؟
total_supply = sum(config.SUPPLY.values())
total_demand = sum(config.DEMAND.values())
print("Total Supply:", total_supply)
print("Total Demand:", total_demand)
if total_supply != total_demand:
    errors.append(f"المسألة مش متوازنة: عرض {total_supply} وطلب {total_demand}")

# النتيجة
print()
if errors:
    print("❌")
    for e in errors:
        print("  -", e)
else:
    print("✅ ")