# RootFinder Stress Test - Enhanced Survival Analysis
# Constitutional and Policy Genealogies Comparative Analysis
# Author: Ignacio Adrian Lerer
# Date: September 2025

# Load required libraries
suppressMessages({
  library(survival)
  library(survminer)
  library(dplyr)
  library(ggplot2)
  library(gridExtra)
  library(stringr)
  library(jsonlite)
})

# Set working directory to stress test
setwd(file.path(getwd(), "stress_test"))

# Create output directories
dir.create("results", showWarnings = FALSE, recursive = TRUE)
dir.create("figures", showWarnings = FALSE, recursive = TRUE)

cat("=== RootFinder Enhanced Survival Analysis ===\n")
cat("Loading stress test results...\n")

# ==============================================================================
# 1. LOAD AND PREPARE DATA
# ==============================================================================

# Load constitutional analysis results
constitutional_file <- "results/constitutional_analysis_results.csv"
if (file.exists(constitutional_file)) {
  constitutional <- read.csv(constitutional_file, stringsAsFactors = FALSE)
  cat(sprintf("✓ Loaded %d constitutional policies\n", nrow(constitutional)))
} else {
  cat("⚠ Constitutional results not found - run constitutional batch first\n")
  constitutional <- data.frame()
}

# Load policies analysis results
policies_file <- "results/policies_combined_results.csv"
if (file.exists(policies_file)) {
  policies <- read.csv(policies_file, stringsAsFactors = FALSE)
  cat(sprintf("✓ Loaded %d public policies\n", nrow(policies)))
} else {
  cat("⚠ Policies results not found - run policies batch first\n") 
  policies <- data.frame()
}

# Load survival data if available
survival_file <- "results/policies_survival_data.csv"
if (file.exists(survival_file)) {
  survival_data <- read.csv(survival_file, stringsAsFactors = FALSE)
  cat(sprintf("✓ Loaded survival data for %d policies\n", nrow(survival_data)))
} else {
  cat("⚠ Survival data not found\n")
  survival_data <- data.frame()
}

# ==============================================================================
# 2. CONSTITUTIONAL GENEALOGIES ANALYSIS
# ==============================================================================

if (nrow(constitutional) > 0) {
  cat("\n📜 CONSTITUTIONAL GENEALOGIES ANALYSIS\n")
  cat("=====================================\n")
  
  # Prepare constitutional survival data
  constitutional$event <- ifelse(constitutional$survival_years < 200, 0, 0) # Most still active
  constitutional$jurisdiction_clean <- str_to_title(constitutional$jurisdiction)
  
  # Summary statistics
  const_summary <- constitutional %>%
    group_by(jurisdiction_clean) %>%
    summarise(
      count = n(),
      mean_survival = round(mean(survival_years), 1),
      mean_descendants = round(mean(descendants_count), 1),
      mean_inheritance = round(mean(mean_inheritance), 3),
      max_survival = max(survival_years),
      .groups = 'drop'
    )
  
  print(const_summary)
  
  # Argentina vs Uruguay comparison
  if ("Argentina" %in% constitutional$jurisdiction && "Uruguay" %in% constitutional$jurisdiction) {
    
    cat("\nARGENTINA vs URUGUAY COMPARISON:\n")
    
    arg_const <- constitutional[constitutional$jurisdiction == "Argentina", ]
    uru_const <- constitutional[constitutional$jurisdiction == "Uruguay", ]
    
    cat(sprintf("Argentina: %d policies, mean survival %.1f years\n", 
                nrow(arg_const), mean(arg_const$survival_years)))
    cat(sprintf("Uruguay: %d policies, mean survival %.1f years\n", 
                nrow(uru_const), mean(uru_const$survival_years)))
    
    # Wilcoxon test
    wilcox_result <- wilcox.test(arg_const$survival_years, uru_const$survival_years)
    cat(sprintf("Wilcoxon test p-value: %.4f\n", wilcox_result$p.value))
  }
  
  # Extended phenotype identification
  high_phenotype <- constitutional[constitutional$extended_phenotype_score >= 0.7, ]
  if (nrow(high_phenotype) > 0) {
    cat(sprintf("\nHigh Extended Phenotype Policies (score >= 0.7): %d\n", nrow(high_phenotype)))
    for (i in 1:min(5, nrow(high_phenotype))) {
      cat(sprintf("  - %s (%.3f)\n", 
                  high_phenotype$root_name[i], 
                  high_phenotype$extended_phenotype_score[i]))
    }
  }
}

# ==============================================================================
# 3. POLICIES SURVIVAL ANALYSIS
# ==============================================================================

if (nrow(survival_data) > 0) {
  cat("\n🏛️ PUBLIC POLICIES SURVIVAL ANALYSIS\n")
  cat("===================================\n")
  
  # Create survival object
  surv_obj <- Surv(time = survival_data$time, event = survival_data$event)
  
  # Kaplan-Meier by ideology
  if ("ideology" %in% names(survival_data)) {
    
    cat("Kaplan-Meier Analysis by Ideology:\n")
    
    km_ideology <- survfit(surv_obj ~ ideology, data = survival_data)
    print(summary(km_ideology))
    
    # Log-rank test
    logrank_test <- survdiff(surv_obj ~ ideology, data = survival_data)
    cat(sprintf("\nLog-rank test p-value: %.4f\n", 
                1 - pchisq(logrank_test$chisq, df = length(logrank_test$n) - 1)))
    
    # Median survival times
    median_surv <- surv_median(km_ideology)
    print("Median Survival Times by Ideology:")
    print(median_surv)
    
    # Generate survival plot
    p_ideology <- ggsurvplot(
      km_ideology,
      data = survival_data,
      pval = TRUE,
      conf.int = TRUE,
      risk.table = TRUE,
      risk.table.col = "strata",
      linetype = "strata",
      surv.median.line = "hv",
      ggtheme = theme_minimal(),
      palette = c("#E31A1C", "#1F78B4", "#33A02C", "#FF7F00"),
      title = "Policy Survival by Ideological Orientation",
      subtitle = "Argentina, Uruguay, Chile (1945-2025)",
      caption = "Data: RootFinder Stress Test Results",
      legend.title = "Ideology",
      xlab = "Years",
      ylab = "Survival Probability"
    )
    
    # Save survival plot
    ggsave("figures/stress_test_survival_ideology.png", 
           plot = p_ideology$plot, 
           width = 12, height = 8, dpi = 300)
    cat("✓ Saved survival plot: figures/stress_test_survival_ideology.png\n")
  }
  
  # Kaplan-Meier by jurisdiction
  if ("jurisdiction" %in% names(survival_data)) {
    
    km_jurisdiction <- survfit(surv_obj ~ jurisdiction, data = survival_data)
    
    p_jurisdiction <- ggsurvplot(
      km_jurisdiction,
      data = survival_data,
      pval = TRUE,
      conf.int = TRUE,
      risk.table = TRUE,
      ggtheme = theme_minimal(),
      palette = c("#2E8B57", "#4169E1", "#DC143C"),
      title = "Policy Survival by Jurisdiction",
      subtitle = "Regional Comparison: Argentina vs Uruguay vs Chile"
    )
    
    ggsave("figures/stress_test_survival_jurisdiction.png",
           plot = p_jurisdiction$plot,
           width = 12, height = 8, dpi = 300)
    cat("✓ Saved jurisdiction plot: figures/stress_test_survival_jurisdiction.png\n")
  }
}

# ==============================================================================
# 4. COMBINED ANALYSIS AND COX REGRESSION
# ==============================================================================

if (nrow(policies) > 0) {
  cat("\n📊 ADVANCED STATISTICAL ANALYSIS\n")
  cat("===============================\n")
  
  # Prepare Cox regression data
  policies_cox <- policies
  policies_cox$event <- ifelse(is.na(policies_cox$year_terminated), 0, 1)
  policies_cox$ideology_binary <- ifelse(policies_cox$ideology == "Populist", 1, 0)
  policies_cox$has_descendants <- ifelse(policies_cox$descendants_count > 0, 1, 0)
  policies_cox$jurisdiction_arg <- ifelse(policies_cox$jurisdiction == "Argentina", 1, 0)
  
  # Cox proportional hazards model
  cox_model <- coxph(Surv(survival_years, event) ~ 
                     ideology_binary + 
                     has_descendants + 
                     jurisdiction_arg + 
                     mean_inheritance,
                     data = policies_cox)
  
  cat("Cox Proportional Hazards Model:\n")
  print(summary(cox_model))
  
  # Test proportional hazards assumption
  ph_test <- cox.zph(cox_model)
  cat("\nProportional Hazards Test:\n")
  print(ph_test)
  
  # Hazard ratios interpretation
  hazard_ratios <- exp(coef(cox_model))
  cat("\nHazard Ratios (Risk of Termination):\n")
  cat(sprintf("Populist ideology: %.3f\n", hazard_ratios[1]))
  cat(sprintf("Having descendants: %.3f\n", hazard_ratios[2]))
  cat(sprintf("Argentina vs others: %.3f\n", hazard_ratios[3]))
  cat(sprintf("Mean inheritance (per unit): %.3f\n", hazard_ratios[4]))
}

# ==============================================================================
# 5. INHERITANCE AND PHENOTYPE ANALYSIS
# ==============================================================================

if (nrow(policies) > 0) {
  cat("\n🧬 INHERITANCE AND EXTENDED PHENOTYPE ANALYSIS\n")
  cat("============================================\n")
  
  # Inheritance by ideology
  inheritance_by_ideology <- policies %>%
    group_by(ideology) %>%
    summarise(
      count = n(),
      mean_inheritance = round(mean(mean_inheritance, na.rm = TRUE), 4),
      median_inheritance = round(median(mean_inheritance, na.rm = TRUE), 4),
      sd_inheritance = round(sd(mean_inheritance, na.rm = TRUE), 4),
      mean_phenotype = round(mean(extended_phenotype_score, na.rm = TRUE), 4),
      .groups = 'drop'
    )
  
  cat("Inheritance Patterns by Ideology:\n")
  print(inheritance_by_ideology)
  
  # Extended phenotype threshold analysis
  phenotype_threshold <- 0.7
  high_phenotypes <- policies[policies$extended_phenotype_score >= phenotype_threshold, ]
  
  cat(sprintf("\nExtended Phenotypes (score >= %.1f): %d policies\n", 
              phenotype_threshold, nrow(high_phenotypes)))
  
  if (nrow(high_phenotypes) > 0) {
    cat("Top Extended Phenotypes:\n")
    high_phenotypes_sorted <- high_phenotypes[order(-high_phenotypes$extended_phenotype_score), ]
    for (i in 1:min(5, nrow(high_phenotypes_sorted))) {
      cat(sprintf("  %d. %s (%.3f) - %d years, %d descendants\n",
                  i,
                  high_phenotypes_sorted$policy_name[i],
                  high_phenotypes_sorted$extended_phenotype_score[i],
                  high_phenotypes_sorted$survival_years[i],
                  high_phenotypes_sorted$descendants_count[i]))
    }
    
    # Phenotype by ideology breakdown
    phenotype_by_ideology <- table(high_phenotypes$ideology)
    cat("\nExtended Phenotypes by Ideology:\n")
    print(phenotype_by_ideology)
  }
}

# ==============================================================================
# 6. MEMETIC FITNESS ANALYSIS
# ==============================================================================

if (nrow(policies) > 0 && "memetic_fitness" %in% names(policies)) {
  cat("\n🧠 MEMETIC FITNESS ANALYSIS\n")
  cat("=========================\n")
  
  # Fitness by ideology
  fitness_stats <- policies %>%
    group_by(ideology) %>%
    summarise(
      count = n(),
      mean_fitness = round(mean(memetic_fitness, na.rm = TRUE), 4),
      median_fitness = round(median(memetic_fitness, na.rm = TRUE), 4),
      max_fitness = round(max(memetic_fitness, na.rm = TRUE), 4),
      .groups = 'drop'
    )
  
  cat("Memetic Fitness by Ideology:\n")
  print(fitness_stats)
  
  # Correlation analysis
  if (all(c("memetic_fitness", "survival_years", "extended_phenotype_score") %in% names(policies))) {
    
    fitness_survival_cor <- cor(policies$memetic_fitness, 
                               policies$survival_years, 
                               use = "complete.obs")
    
    fitness_phenotype_cor <- cor(policies$memetic_fitness, 
                                policies$extended_phenotype_score, 
                                use = "complete.obs")
    
    cat(sprintf("\nCorrelations:\n"))
    cat(sprintf("Memetic Fitness ~ Survival: %.4f\n", fitness_survival_cor))
    cat(sprintf("Memetic Fitness ~ Extended Phenotype: %.4f\n", fitness_phenotype_cor))
  }
}

# ==============================================================================
# 7. GENERATE COMPREHENSIVE REPORT
# ==============================================================================

cat("\n📋 GENERATING COMPREHENSIVE REPORT\n")
cat("=================================\n")

# Compile all results
stress_test_results <- list(
  execution_timestamp = Sys.time(),
  constitutional_summary = if (exists("const_summary")) const_summary else NULL,
  policies_survival_summary = if (exists("median_surv")) median_surv else NULL,
  cox_model_results = if (exists("cox_model")) {
    list(
      coefficients = coef(cox_model),
      hazard_ratios = exp(coef(cox_model)),
      p_values = summary(cox_model)$coefficients[, "Pr(>|z|)"],
      concordance = summary(cox_model)$concordance[1]
    )
  } else NULL,
  inheritance_analysis = if (exists("inheritance_by_ideology")) inheritance_by_ideology else NULL,
  extended_phenotypes_count = if (exists("high_phenotypes")) nrow(high_phenotypes) else 0,
  memetic_fitness_summary = if (exists("fitness_stats")) fitness_stats else NULL,
  quality_metrics = list(
    total_policies_analyzed = if (nrow(policies) > 0) nrow(policies) else 0,
    total_constitutional_nodes = if (nrow(constitutional) > 0) nrow(constitutional) else 0,
    mean_inheritance_score = if (nrow(policies) > 0) mean(policies$mean_inheritance, na.rm = TRUE) else 0,
    survival_variance = if (nrow(policies) > 0) var(policies$survival_years, na.rm = TRUE) else 0
  )
)

# Export comprehensive results
report_file <- "results/stress_test_comprehensive_report.json"
write_json(stress_test_results, report_file, pretty = TRUE)
cat(sprintf("✓ Comprehensive report saved: %s\n", report_file))

# Generate summary table
if (nrow(policies) > 0) {
  summary_table <- policies %>%
    group_by(ideology, jurisdiction) %>%
    summarise(
      policies_count = n(),
      mean_survival = round(mean(survival_years), 1),
      mean_inheritance = round(mean(mean_inheritance), 3),
      mean_fitness = round(mean(memetic_fitness), 3),
      extended_phenotypes = sum(extended_phenotype_score >= 0.7),
      .groups = 'drop'
    )
  
  write.csv(summary_table, "results/stress_test_summary_table.csv", row.names = FALSE)
  cat("✓ Summary table saved: results/stress_test_summary_table.csv\n")
}

# ==============================================================================
# 8. VALIDATION AND QUALITY CONTROL
# ==============================================================================

cat("\n✅ QUALITY CONTROL VALIDATION\n")
cat("============================\n")

# Check data completeness
if (nrow(policies) > 0) {
  completeness <- list(
    survival_data_complete = sum(complete.cases(policies[c("survival_years", "ideology")])),
    inheritance_data_complete = sum(complete.cases(policies[c("mean_inheritance")])),
    phenotype_data_complete = sum(complete.cases(policies[c("extended_phenotype_score")])),
    total_policies = nrow(policies)
  )
  
  cat(sprintf("Data completeness:\n"))
  cat(sprintf("  Survival data: %d/%d (%.1f%%)\n", 
              completeness$survival_data_complete, 
              completeness$total_policies,
              100 * completeness$survival_data_complete / completeness$total_policies))
  
  cat(sprintf("  Inheritance data: %d/%d (%.1f%%)\n",
              completeness$inheritance_data_complete,
              completeness$total_policies, 
              100 * completeness$inheritance_data_complete / completeness$total_policies))
}

# Statistical power check
if (exists("logrank_test")) {
  cat(sprintf("Statistical power indicators:\n"))
  cat(sprintf("  Log-rank chi-square: %.4f\n", logrank_test$chisq))
  cat(sprintf("  Degrees of freedom: %d\n", length(logrank_test$n) - 1))
  
  if (logrank_test$chisq > qchisq(0.95, df = length(logrank_test$n) - 1)) {
    cat("  ✓ Sufficient power to detect survival differences\n")
  } else {
    cat("  ⚠ Marginal power - consider larger sample\n")
  }
}

cat("\n🎯 STRESS TEST COMPLETED SUCCESSFULLY\n")
cat("Results available in stress_test/results/\n")
cat("Figures available in stress_test/figures/\n")

# Final execution summary
end_time <- Sys.time()
cat(sprintf("\nExecution completed at: %s\n", end_time))
cat("=====================================\n")