"""
Example: Tracking Aguinaldo Policy Genealogy
Author: Ignacio Adrian Lerer
Date: September 2025
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from rootfinder import PolicyGenealogy

def analyze_aguinaldo():
    """Analyze the genealogy of Argentina's aguinaldo policy"""
    
    # Initialize genealogy tracker
    genealogy = PolicyGenealogy()
    
    # Load policy corpus
    genealogy.load_corpus("../../data/policy-genealogy-argentina.csv")
    
    # Trace aguinaldo lineage
    aguinaldo_lineage = genealogy.trace_lineage("POL001")
    
    print("AGUINALDO POLICY ANALYSIS")
    print("=" * 50)
    print(f"Policy: {aguinaldo_lineage.root_policy.name}")
    print(f"Created: {aguinaldo_lineage.root_policy.year_created}")
    print(f"Survival: {aguinaldo_lineage.root_policy.survival_years} years")
    print(f"Status: {'Active' if aguinaldo_lineage.root_policy.is_active else 'Terminated'}")
    print()
    
    print("GENEALOGICAL ANALYSIS")
    print("-" * 30)
    print(f"Total descendants: {aguinaldo_lineage.total_descendants}")
    print(f"Mean inheritance score: {aguinaldo_lineage.mean_inheritance:.3f}")
    print(f"Max inheritance score: {aguinaldo_lineage.max_inheritance:.3f}")
    print()
    
    print("DESCENDANT POLICIES:")
    for descendant in aguinaldo_lineage.descendants:
        inheritance = aguinaldo_lineage.inheritance_scores[descendant.id]
        print(f"  - {descendant.name} ({descendant.year_created})")
        print(f"    Inheritance score: {inheritance:.3f}")
        print(f"    Survival: {descendant.survival_years} years")
    
    # Check if qualifies as extended phenotype
    phenotype_score = genealogy._calculate_phenotype_score(
        aguinaldo_lineage.root_policy
    )
    print()
    print(f"EXTENDED PHENOTYPE SCORE: {phenotype_score:.3f}")
    if phenotype_score >= 0.7:
        print("✓ Qualifies as political extended phenotype")
    else:
        print("✗ Does not qualify as extended phenotype")
    
    # Export genealogy
    json_output = genealogy.export_genealogy("POL001", format="json")
    with open("aguinaldo_genealogy.json", "w") as f:
        f.write(json_output)
    print("\nGenealogy exported to aguinaldo_genealogy.json")
    
    # Create visualization (if matplotlib available)
    try:
        genealogy.visualize_genealogy("POL001", "aguinaldo_genealogy.png")
        print("Visualization saved to aguinaldo_genealogy.png")
    except ImportError:
        print("Matplotlib not available - skipping visualization")

if __name__ == "__main__":
    analyze_aguinaldo()