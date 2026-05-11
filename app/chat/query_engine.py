def answer_question(df, question):
    question = question.lower().strip()

    numeric_cols = list(df.select_dtypes(include=["number"]).columns)
    numeric_cols_lower = [col.lower().strip() for col in numeric_cols]

    column = None

    # exact column name match inside question
    for original, lower_col in zip(numeric_cols, numeric_cols_lower):
        if lower_col in question:
            column = original
            break

    # if still not found, split question into words and compare
    if column is None:
        words = question.split()
        for original, lower_col in zip(numeric_cols, numeric_cols_lower):
            if lower_col in words:
                column = original
                break

    # average
    if "average" in question or "mean" in question:
        if column is None:
            return f"Please specify one of these numeric columns: {numeric_cols}"
        return f"The average {column} is {round(df[column].mean(), 2)}"

    # max / highest
    if "max" in question or "highest" in question:
        if column is None:
            return f"Please specify one of these numeric columns: {numeric_cols}"
        return f"The highest {column} is {df[column].max()}"

    # min / lowest
    if "min" in question or "lowest" in question:
        if column is None:
            return f"Please specify one of these numeric columns: {numeric_cols}"
        return f"The lowest {column} is {df[column].min()}"

    # correlation
    if "correlation" in question:
        if len(numeric_cols) < 2:
            return "Not enough numeric columns for correlation."
        return df[numeric_cols].corr().to_dict()

    return "I could not understand the question."