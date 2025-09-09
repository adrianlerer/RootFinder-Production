# RootFinder Survival Analysis
# Policy Longevity and Ideological Persistence Analysis
# Author: Ignacio Adrian Lerer
# Date: September 2025

# Load required libraries
library(survival)
library(survminer)
library(dplyr)
library(ggplot2)
library(KMsurv)
library(gridExtra)

# Set working directory (adjust as needed)
setwd("/home/user/RootFinder-Production")

# Load policy genealogy data
policies <- read.csv("data/policy-genealogy-argentina.csv", stringsAsFactors = FALSE)

# Prepare survival data
# Create survival objects
policies$survival_years <- ifelse(is.na(policies$year_terminated), 
                                 2025 - policies$year_created,
                                 policies$year_terminated - policies$year_created)

policies$terminated <- ifelse(is.na(policies$year_terminated), 0, 1)

# Create Surv object
surv_object <- Surv(time = policies$survival_years, event = policies$terminated)

# ==============================================================================
# 1. KAPLAN-MEIER SURVIVAL ANALYSIS BY IDEOLOGICAL ORIENTATION
# ==============================================================================

# Fit Kaplan-Meier curves by ideology
km_fit_ideology <- survfit(surv_object ~ ideological_orientation, data = policies)

# Generate survival plot by ideology
p1 <- ggsurvplot(
  km_fit_ideology,
  data = policies,
  pval = TRUE,
  conf.int = TRUE,
  risk.table = TRUE,
  risk.table.col = "strata",
  linetype = "strata",
  surv.median.line = "hv",
  ggtheme = theme_bw(),
  palette = c("#E7B800", "#2E9FDF"),
  title = "Policy Survival by Ideological Orientation",
  subtitle = "Argentina 1945-2025: Extended Phenotype Analysis",
  caption = "Data: RootFinder Policy Genealogy Database"
)

# Print survival summary
print("=== KAPLAN-MEIER SURVIVAL ANALYSIS BY IDEOLOGY ===")
print(summary(km_fit_ideology))

# Calculate median survival times
median_survival <- surv_median(km_fit_ideology)
print("Median Survival Times by Ideology:")
print(median_survival)

# ==============================================================================
# 2. COX PROPORTIONAL HAZARDS REGRESSION
# ==============================================================================

# Prepare covariates
policies$ideology_numeric <- ifelse(policies$ideological_orientation == "Populist", 1, 0)
policies$has_descendants <- ifelse(policies$descendants_count > 0, 1, 0)
policies$policy_type_factor <- as.factor(policies$policy_type)

# Fit Cox regression model
cox_model <- coxph(surv_object ~ ideology_numeric + has_descendants + 
                   policy_type_factor, data = policies)

# Print Cox model summary
print("=== COX PROPORTIONAL HAZARDS REGRESSION ===")
print(summary(cox_model))

# Test proportional hazards assumption
print("=== TESTING PROPORTIONAL HAZARDS ASSUMPTION ===")
test_ph <- cox.zph(cox_model)
print(test_ph)

# ==============================================================================
# 3. SURVIVAL ANALYSIS BY POLICY TYPE
# ==============================================================================

# Kaplan-Meier by policy type
km_fit_type <- survfit(surv_object ~ policy_type, data = policies)

p2 <- ggsurvplot(
  km_fit_type,
  data = policies,
  pval = TRUE,
  conf.int = FALSE,
  risk.table = FALSE,
  ggtheme = theme_bw(),
  title = "Policy Survival by Type",
  subtitle = "Argentina 1945-2025"
)

# ==============================================================================
# 4. GOVERNMENT-SPECIFIC SURVIVAL ANALYSIS
# ==============================================================================

# Group governments by era for cleaner visualization
policies$era <- case_when(
  policies$government %in% c("Peron") ~ "Peronist Era (1945-1955)",
  policies$government %in% c("Videla", "Military") ~ "Military Era (1976-1983)",
  policies$government %in% c("Menem") ~ "Menem Era (1989-1999)",
  policies$government %in% c("Nestor Kirchner", "Cristina Kirchner") ~ "Kirchner Era (2003-2015)",
  policies$government %in% c("Macri") ~ "Macri Era (2015-2019)",
  policies$government %in% c("Alberto Fernandez") ~ "Fernandez Era (2019-2023)",
  policies$government %in% c("Milei") ~ "Milei Era (2023-)",
  TRUE ~ "Other"
)

km_fit_era <- survfit(surv_object ~ era, data = policies)

p3 <- ggsurvplot(
  km_fit_era,
  data = policies,
  pval = TRUE,
  conf.int = FALSE,
  risk.table = FALSE,
  ggtheme = theme_bw(),
  title = "Policy Survival by Government Era"
)

# ==============================================================================
# 5. EXTENDED PHENOTYPE SCORE ANALYSIS
# ==============================================================================

# Calculate extended phenotype scores (simplified version)
calculate_extended_phenotype_score <- function(policy_data) {
  scores <- numeric(nrow(policy_data))
  
  for (i in 1:nrow(policy_data)) {
    # Environmental modification (descendants)
    env_mod <- min(policy_data$descendants_count[i] / 10, 1.0)
    
    # Persistence (survival years normalized)
    persistence <- min(policy_data$survival_years[i] / 50, 1.0)
    
    # Heritability (simplified - based on having descendants)
    heritability <- ifelse(policy_data$descendants_count[i] > 0, 0.8, 0.2)
    
    # Reproductive enhancement (ideology-based)
    reproductive <- ifelse(policy_data$ideological_orientation[i] == "Populist", 0.8, 0.3)
    
    # Combined score
    scores[i] <- (env_mod * 0.25 + persistence * 0.25 + 
                  heritability * 0.25 + reproductive * 0.25)
  }
  
  return(scores)
}

policies$extended_phenotype_score <- calculate_extended_phenotype_score(policies)

# Identify high-scoring extended phenotypes (threshold = 0.7)
extended_phenotypes <- policies[policies$extended_phenotype_score >= 0.7, ]

print("=== IDENTIFIED EXTENDED PHENOTYPES (Score >= 0.7) ===")
print(extended_phenotypes[, c("policy_name", "survival_years", "descendants_count", 
                             "ideological_orientation", "extended_phenotype_score")])

# ==============================================================================
# 6. STATISTICAL TESTS AND COMPARISONS
# ==============================================================================

# Log-rank test for ideology comparison
logrank_test <- survdiff(surv_object ~ ideological_orientation, data = policies)
print("=== LOG-RANK TEST (Ideology Comparison) ===")
print(logrank_test)

# Wilcoxon test for survival differences
print("=== WILCOXON TEST RESULTS ===")
pairwise_survdiff(surv_object ~ ideological_orientation, data = policies)

# ==============================================================================
# 7. EXPORT RESULTS
# ==============================================================================

# Create results directory
dir.create("results/survival-analysis", recursive = TRUE, showWarnings = FALSE)

# Save survival curves
ggsave("results/survival-analysis/survival_by_ideology.png", 
       plot = p1$plot, width = 12, height = 8, dpi = 300)

ggsave("results/survival-analysis/survival_by_type.png", 
       plot = p2$plot, width = 12, height = 8, dpi = 300)

ggsave("results/survival-analysis/survival_by_era.png", 
       plot = p3$plot, width = 12, height = 8, dpi = 300)

# Export extended phenotype results
write.csv(extended_phenotypes, 
          "results/survival-analysis/extended_phenotypes.csv", 
          row.names = FALSE)

# Export survival statistics
survival_stats <- list(
  median_survival_ideology = median_survival,
  cox_model_summary = summary(cox_model),
  logrank_test = logrank_test,
  extended_phenotype_count = nrow(extended_phenotypes)
)

# Save as RData
save(survival_stats, km_fit_ideology, cox_model, policies, 
     file = "results/survival-analysis/survival_analysis_results.RData")

print("=== ANALYSIS COMPLETE ===")
print(paste("Results saved to:", getwd(), "/results/survival-analysis/"))
print(paste("Extended phenotypes identified:", nrow(extended_phenotypes)))
print("Key findings:")
print(paste("- Populist policies median survival:", 
            median_survival$median[median_survival$strata == "ideological_orientation=Populist"]))
print(paste("- Liberal policies median survival:", 
            median_survival$median[median_survival$strata == "ideological_orientation=Liberal"]))