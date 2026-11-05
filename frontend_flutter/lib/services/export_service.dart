import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/app_theme.dart';
import 'api_service.dart';

class ExportService {
  static void showExportExcelModal(BuildContext context) {
    DateTime selectedUptoDate = DateTime.now();
    DateTime? selectedFromDate;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final uptoStr = DateFormat('yyyy-MM-dd').format(selectedUptoDate);
            final displayUptoStr = DateFormat('dd MMM yyyy').format(selectedUptoDate);
            final fromStr = selectedFromDate != null ? DateFormat('yyyy-MM-dd').format(selectedFromDate!) : null;
            final displayFromStr = selectedFromDate != null ? DateFormat('dd MMM yyyy').format(selectedFromDate!) : 'All Historical';

            return Container(
              padding: EdgeInsets.only(
                top: 20,
                left: 20,
                right: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF16A34A).withOpacity(0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.table_chart, color: Color(0xFF16A34A), size: 24),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              'Export Financial Report',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Download Excel (.xlsx) with Income & Expenses',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Icon(Icons.info_outline, size: 18, color: Color(0xFF166534)),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Exports a complete 4-sheet workbook: Executive Summary, Income & Advances, Expenses, and Combined Ledger.',
                            style: TextStyle(fontSize: 12, color: Color(0xFF15803D), height: 1.35),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Select Date Up To Which You Need Data *',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: selectedUptoDate,
                        firstDate: DateTime(2020),
                        lastDate: DateTime(2035),
                      );
                      if (picked != null) {
                        setSheetState(() {
                          selectedUptoDate = picked;
                        });
                      }
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppTheme.border),
                        borderRadius: BorderRadius.circular(12),
                        color: Colors.grey.shade50,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.calendar_today, size: 18, color: AppTheme.primary),
                              const SizedBox(width: 10),
                              Text(
                                displayUptoStr,
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                              ),
                            ],
                          ),
                          const Icon(Icons.arrow_drop_down, color: AppTheme.textSecondary),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'From Date (Optional)',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: selectedFromDate ?? DateTime(2026, 1, 1),
                        firstDate: DateTime(2020),
                        lastDate: selectedUptoDate,
                      );
                      if (picked != null) {
                        setSheetState(() {
                          selectedFromDate = picked;
                        });
                      }
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppTheme.border),
                        borderRadius: BorderRadius.circular(12),
                        color: Colors.grey.shade50,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.date_range_outlined, size: 18, color: AppTheme.textSecondary),
                              const SizedBox(width: 10),
                              Text(
                                displayFromStr,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: selectedFromDate != null ? FontWeight.w700 : FontWeight.normal,
                                  color: selectedFromDate != null ? AppTheme.textPrimary : AppTheme.textMuted,
                                ),
                              ),
                            ],
                          ),
                          if (selectedFromDate != null)
                            IconButton(
                              icon: const Icon(Icons.close, size: 16),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: () {
                                setSheetState(() {
                                  selectedFromDate = null;
                                });
                              },
                            )
                          else
                            const Icon(Icons.arrow_drop_down, color: AppTheme.textSecondary),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      onPressed: () async {
                        Navigator.pop(ctx);
                        triggerExcelDownload(context, uptoStr, fromStr);
                      },
                      icon: const Icon(Icons.download, size: 20),
                      label: const Text(
                        'Download Excel (.xlsx)',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  static Future<void> triggerExcelDownload(BuildContext context, String uptoDate, String? fromDate) async {
    try {
      final token = await ApiService.getToken();
      var url = '${ApiService.baseUrl}/reports/export-excel?upto_date=$uptoDate';
      if (fromDate != null) {
        url += '&from_date=$fromDate';
      }
      if (token != null) {
        url += '&token=$token';
      }

      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Downloading Excel report up to $uptoDate...'),
            backgroundColor: const Color(0xFF16A34A),
          ),
        );
      } else {
        throw Exception('Could not launch browser for download.');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Export failed: ${e.toString()}'),
          backgroundColor: AppTheme.accentRed,
        ),
      );
    }
  }
}
