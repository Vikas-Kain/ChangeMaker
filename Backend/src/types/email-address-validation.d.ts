declare module 'email-address-validation' {
    interface EmailValidationResult {
        email: string;
        format_valid: boolean;
        mx_found: boolean;
        smtp_check: boolean;
        catch_all: boolean;
        role: boolean;
        disposable: boolean;
        free_email: boolean;
        score: number;
    }

    class EmailValidationAPI {
        constructor(config: { access_key: string });
        check(email: string): Promise<EmailValidationResult>;
    }

    export = EmailValidationAPI;
}
